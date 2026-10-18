/**
 * Local file tailing source for the Local Observability feature.
 *
 * Tails an existing log file and emits complete lines as they are appended.
 * Never modifies or deletes the original file.
 *
 * Robustness:
 *   - Starts at the end of the file by default (no historical lines streamed).
 *   - Optional `loadRecentLines` reads the last N complete lines at start.
 *   - Detects appends without re-reading the whole file (tracks byte offset).
 *   - Detects truncation (size shrinks) and resets to the start.
 *   - Detects rotation/restart via inode change and re-opens from the start.
 *   - Handles partial (no-trailing-newline) lines by buffering until newline.
 *   - Falls back to polling when `fs.watch` is unavailable (network drives,
 *     some Windows paths). Always polls stat at a low frequency as a safety
 *     net because `fs.watch` is unreliable across platforms.
 *   - Missing/permission-denied files emit a `missing`/`error` state and keep
 *     polling so the source recovers when the file appears.
 *   - Pause/resume stops line emission without releasing the file handle so
 *     resume can continue from the current offset.
 *
 * Emits (via the handlers passed to `start`):
 *   onLine(line: string)                 — a complete raw line (no trailing \n)
 *   onState(state)                        — 'following' | 'missing' | 'error' | 'truncated' | 'rotated' | 'paused' | 'stopped'
 *   onError(error: Error)
 *
 * Pure Node — no Electron. Fully testable (file ops via injectable fs for unit
 * tests).
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { nanoid } = require('nanoid');

const DEFAULT_POLL_MS = 1000;
const DEFAULT_RECENT_LINES = 200;
const MAX_RECENT_READ_BYTES = 1024 * 1024; // cap recent-history read at 1MB
const WATCH_DEBOUNCE_MS = 100;

const isWindows = process.platform === 'win32';

class FileTailSource {
  constructor(options = {}) {
    if (!options.filePath) throw new Error('FileTailSource requires filePath');
    this.filePath = options.filePath;
    this.sourceId = options.sourceId || `file:${nanoid(8)}`;
    this.name = options.name || path.basename(options.filePath);
    this.startFromEnd = options.startFromEnd !== false; // default true
    this.loadRecentLines = !!options.loadRecentLines;
    this.recentLinesCount = options.recentLinesCount || DEFAULT_RECENT_LINES;
    this.pollMs = options.pollMs || DEFAULT_POLL_MS;
    this.fs = options.fs || fs; // injectable for tests
    this.fsp = options.fsp || fsp;

    this._fd = null;
    this._inode = null;
    this._size = 0;
    this._lineBuffer = '';
    this._watcher = null;
    this._pollTimer = null;
    this._checkTimer = null;
    this._paused = false;
    this._running = false;
    this._handlers = null;
    this._checkBound = this._check.bind(this);
  }

  async start(handlers) {
    this._handlers = handlers || {};
    this._running = true;
    this.onState('following'); // optimistic; _check will correct it

    // Try fs.watch first; polling is always also running as a safety net.
    try {
      this._watcher = this.fs.watch(this.filePath, { persistent: false }, (eventType) => {
        if (eventType === 'rename' || eventType === 'change') {
          this._scheduleCheck();
        }
      });
      this._watcher.on('error', () => { /* polling will recover */ });
    } catch {
      // watch unavailable — polling handles it
    }

    await this._check();
    this._pollTimer = setInterval(this._checkBound, this.pollMs);
    if (typeof this._pollTimer.unref === 'function') this._pollTimer.unref();
  }

  _scheduleCheck() {
    if (this._checkTimer) return;
    this._checkTimer = setTimeout(() => {
      this._checkTimer = null;
      this._check();
    }, WATCH_DEBOUNCE_MS);
    if (typeof this._checkTimer.unref === 'function') this._checkTimer.unref();
  }

  async _check() {
    if (!this._running) return;
    // Serialize checks: fs.watch and the poll timer can both fire for the same
    // append, and without serialization two _check() calls interleave at their
    // await points, both pass the `size > _size` gate with the stale _size, and
    // both read the same bytes → duplicate line emission.
    if (this._checking) {
      this._checkRequested = true;
      return;
    }
    this._checking = true;
    try {
      await this._doCheck();
    } finally {
      this._checking = false;
      if (this._checkRequested && this._running) {
        this._checkRequested = false;
        this._check();
      }
    }
  }

  async _doCheck() {
    let stat;
    try {
      stat = await this.fsp.stat(this.filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.onState('missing');
        return;
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        this.onState('error');
        this.onError(err);
        return;
      }
      this.onState('error');
      this.onError(err);
      return;
    }

    if (!stat.isFile()) {
      this.onState('error');
      this.onError(new Error(`Not a regular file: ${this.filePath}`));
      return;
    }

    const inode = stat.ino || stat.dev ? `${stat.dev}:${stat.ino}` : null;

    // Rotation/restart: inode changed → re-open from start.
    if (this._fd !== null && inode && this._inode && inode !== this._inode) {
      await this._closeFd();
      this._fd = null;
      this._inode = null;
      this._size = 0;
      this._lineBuffer = '';
      this.onState('rotated');
    }

    // Open the file if needed.
    if (this._fd === null) {
      try {
        this._fd = await this.fsp.open(this.filePath, 'r');
        this._inode = inode;
        if (this.startFromEnd && !this.loadRecentLines) {
          this._size = stat.size;
          // Position at end. Read any bytes after end as appends.
          this.onState('following');
          return;
        }
        // Load recent history or read from start.
        this._size = 0;
        if (this.loadRecentLines) {
          await this._loadRecent(stat.size);
        }
        this.onState('following');
        return;
      } catch (err) {
        this._fd = null;
        this.onState('error');
        this.onError(err);
        return;
      }
    }

    // Truncation: file shrank → reset to start.
    if (stat.size < this._size) {
      this._size = 0;
      this._lineBuffer = '';
      if (this._fd !== null && typeof this._fd.close === 'function') {
        try { await this._fd.close(); } catch {}
      }
      try {
        this._fd = await this.fsp.open(this.filePath, 'r');
        this.onState('truncated');
      } catch (err) {
        this._fd = null;
        this.onState('error');
        this.onError(err);
        return;
      }
    }

    // Read appends.
    if (stat.size > this._size) {
      const len = stat.size - this._size;
      const buf = Buffer.alloc(len);
      try {
        await this._fd.read(buf, 0, len, this._size);
      } catch (err) {
        this.onState('error');
        this.onError(err);
        return;
      }
      this._size = stat.size;
      this._ingest(buf.toString('utf8'));
    }
  }

  async _loadRecent(fileSize) {
    const readLen = Math.min(fileSize, MAX_RECENT_READ_BYTES);
    const start = fileSize - readLen;
    const buf = Buffer.alloc(readLen);
    await this._fd.read(buf, 0, readLen, start);
    let text = buf.toString('utf8');
    // If we sliced into the middle of a line, drop the first partial line.
    if (start > 0) {
      const firstNl = text.indexOf('\n');
      if (firstNl !== -1) text = text.slice(firstNl + 1);
    }
    const lines = text.split('\n');
    // Trim trailing empty (file ends with \n).
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    const keep = lines.slice(-this.recentLinesCount);
    for (const line of keep) {
      this.onLine(line);
    }
    this._size = fileSize;
  }

  _ingest(chunk) {
    this._lineBuffer += chunk;
    let idx;
    while ((idx = this._lineBuffer.indexOf('\n')) !== -1) {
      const line = this._lineBuffer.slice(0, idx).replace(/\r$/, '');
      this._lineBuffer = this._lineBuffer.slice(idx + 1);
      if (!this._paused) this.onLine(line);
    }
  }

  pause() {
    this._paused = true;
    this.onState('paused');
  }

  resume() {
    this._paused = false;
    this.onState('following');
  }

  isPaused() {
    return this._paused;
  }

  getState() {
    return {
      sourceId: this.sourceId,
      type: 'file',
      name: this.name,
      filePath: this.filePath,
      paused: this._paused,
      running: this._running,
      inode: this._inode,
      size: this._size
    };
  }

  async _closeFd() {
    if (this._fd !== null) {
      try {
        // `fsp.open` returns a FileHandle (not an integer fd), so we call its
        // `.close()` method. Using `fsp.close(handle)` would throw and leak
        // the OS file handle — which on Windows also locks the directory and
        // breaks temp-dir cleanup in tests.
        if (typeof this._fd.close === 'function') {
          await this._fd.close();
        } else {
          await this.fsp.close(this._fd);
        }
      } catch {
        // ignore
      }
      this._fd = null;
    }
  }

  async stop() {
    this._running = false;
    if (this._watcher) {
      try { this._watcher.close(); } catch {}
      this._watcher = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._checkTimer) {
      clearTimeout(this._checkTimer);
      this._checkTimer = null;
    }
    await this._closeFd();
    this._lineBuffer = '';
    this.onState('stopped');
  }

  // Emit helpers (no-op if handlers not set).
  onLine(line) { this._handlers?.onLine?.(line); }
  onState(state) { this._handlers?.onState?.(state); }
  onError(err) { this._handlers?.onError?.(err); }
}

module.exports = { FileTailSource, DEFAULT_POLL_MS, DEFAULT_RECENT_LINES };
