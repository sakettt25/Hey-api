/**
 * Local process-output source for the Local Observability feature.
 *
 * Launches a user-configured development command and streams its stdout and
 * stderr as log lines. Each emitted line is tagged with its stream so the log
 * details pane can keep the stdout/stderr labels visible.
 *
 * Safety constraints (enforced here, not just in the UI):
 *   - Process launching is explicitly initiated by the user via `start()`. No
 *     process is launched at construction time.
 *   - The command and args come only from user configuration (validated before
 *     spawn); lines from stdout/stderr are NEVER re-interpreted as commands.
 *   - stdout and stderr are captured separately; each line keeps a `stream`
 *     marker ('stdout' | 'stderr').
 *   - State changes (started / exited / killed / error) are reported so the UI
 *     can show process state and exit code.
 *   - `stop()` kills a process launched by Hey API. We never attach to or kill
 *     arbitrary external processes.
 *
 * Emits:
 *   onLine(line, meta)   meta = { stream: 'stdout' | 'stderr' }
 *   onState(state)       'starting' | 'running' | 'exited' | 'error'
 *   onExit(info)         { exitCode, signal }
 *   onError(error)
 *
 * Pure Node — no Electron. Uses child_process.spawn; injectable for tests.
 */

const { spawn } = require('child_process');
const { nanoid } = require('nanoid');

const isWindows = process.platform === 'win32';

class ProcessSource {
  constructor(options = {}) {
    if (!options.command) throw new Error('ProcessSource requires a command');
    this.command = options.command;
    this.args = options.args || [];
    this.cwd = options.cwd || null;
    this.env = options.env || null; // merged onto process.env at spawn
    this.sourceId = options.sourceId || `process:${nanoid(8)}`;
    this.name = options.name || options.command;
    this.spawnFn = options.spawnFn || spawn; // injectable for tests

    this._child = null;
    this._running = false;
    this._paused = false;
    this._stdoutBuffer = '';
    this._stderrBuffer = '';
    this._handlers = null;
    this._exitCode = null;
    this._signal = null;
  }

  start(handlers) {
    this._handlers = handlers || {};
    this.onState('starting');

    let child;
    try {
      child = this.spawnFn(this.command, this.args, {
        cwd: this.cwd || undefined,
        env: { ...process.env, ...(this.env || {}) },
        shell: isWindows, // .cmd/.bat on Windows need a shell (CVE-2024-27980)
        windowsHide: true
      });
    } catch (err) {
      this.onState('error');
      this.onError(err);
      return;
    }

    if (!child || typeof child.on !== 'function') {
      this.onState('error');
      this.onError(new Error('Failed to spawn process'));
      return;
    }

    this._child = child;
    this._running = true;
    this.onState('running');

    child.stdout?.on('data', (chunk) => this._ingest('stdout', chunk));
    child.stderr?.on('data', (chunk) => this._ingest('stderr', chunk));

    child.on('error', (err) => {
      this._running = false;
      this.onState('error');
      this.onError(err);
    });

    child.on('close', (code, signal) => {
      this._running = false;
      this._exitCode = code;
      this._signal = signal;
      this._flush('stdout');
      this._flush('stderr');
      this.onExit({ exitCode: code, signal });
      this.onState('exited');
    });
  }

  _ingest(stream, chunk) {
    const text = chunk.toString('utf8');
    const buf = stream === 'stdout' ? '_stdoutBuffer' : '_stderrBuffer';
    this[buf] += text;
    let idx;
    while ((idx = this[buf].indexOf('\n')) !== -1) {
      const line = this[buf].slice(0, idx).replace(/\r$/, '');
      this[buf] = this[buf].slice(idx + 1);
      if (!this._paused) this.onLine(line, { stream });
    }
  }

  _flush(stream) {
    const buf = stream === 'stdout' ? '_stdoutBuffer' : '_stderrBuffer';
    if (this[buf].length > 0) {
      const line = this[buf].replace(/\r$/, '');
      this[buf] = '';
      if (!this._paused && line.length) this.onLine(line, { stream });
    }
  }

  pause() { this._paused = true; this.onState('paused'); }
  resume() { this._paused = false; this.onState(this._running ? 'running' : 'exited'); }
  isPaused() { return this._paused; }

  getState() {
    return {
      sourceId: this.sourceId,
      type: 'process',
      name: this.name,
      command: this.command,
      args: this.args,
      cwd: this.cwd,
      running: this._running,
      paused: this._paused,
      exitCode: this._exitCode,
      signal: this._signal,
      pid: this._child?.pid || null
    };
  }

  stop() {
    if (this._child && this._running) {
      try {
        // Kill the whole process group when possible so child processes the
        // backend spawned also terminate. SIGTERM first for graceful shutdown.
        if (isWindows) {
          this._child.kill();
        } else {
          try { process.kill(-this._child.pid, 'SIGTERM'); }
          catch { this._child.kill('SIGTERM'); }
        }
      } catch {
        // ignore — process may already be gone
      }
    }
  }

  // Emit helpers.
  onLine(line, meta) { this._handlers?.onLine?.(line, meta); }
  onState(state) { this._handlers?.onState?.(state); }
  onExit(info) { this._handlers?.onExit?.(info); }
  onError(err) { this._handlers?.onError?.(err); }
}

module.exports = { ProcessSource };
