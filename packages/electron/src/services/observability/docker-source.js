/**
 * Optional Docker container-logs source for the Local Observability feature.
 *
 * Streams logs from a locally selected Docker container via the local Docker
 * daemon — no remote logging backend required.
 *
 * Safety:
 *   - Never starts, stops, deletes, or modifies containers. Only reads logs.
 *   - Detects whether Docker is installed and reachable (graceful "not
 *     available" error if not).
 *   - Lets the user explicitly select a container (no auto-attach).
 *   - Keeps Docker integration fully optional; the core log viewer does not
 *     require Docker.
 *
 * All Docker access is via the local `docker` CLI (spawned with bounded output)
 * rather than the Docker socket directly, so no extra native dependencies are
 * required and permissions mirror what the user already has at the shell.
 *
 * Emits the same line/state/error interface as the other sources.
 */

const { execFile, spawn } = require('child_process');
const { nanoid } = require('nanoid');

const isWindows = process.platform === 'win32';

const DOCKER_BIN = process.env.BRUNO_DOCKER_BIN || 'docker';

/**
 * Detect whether the local Docker daemon is installed and reachable.
 * Resolves with { available: boolean, version: string|null, error: string|null }.
 * Never rejects.
 */
const detectDocker = () =>
  new Promise((resolve) => {
    const child = execFile(DOCKER_BIN, ['--version'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ available: false, version: null, error: err.message || 'docker not found' });
        return;
      }
      resolve({ available: true, version: stdout.trim(), error: null });
    });
    child.on('error', () => resolve({ available: false, version: null, error: 'docker not found on PATH' }));
  });

/**
 * List local containers. Resolves with an array of { id, name, image, status }.
 * Never rejects — errors come back as an empty array + an error message.
 */
const listContainers = () =>
  new Promise((resolve) => {
    const args = ['ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'];
    execFile(DOCKER_BIN, args, { windowsHide: true, maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout) => {
      if (err) {
        resolve({ containers: [], error: err.message || 'docker ps failed' });
        return;
      }
      const containers = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [id, name, image, status] = line.split('\t');
          return { id, name, image, status };
        });
      resolve({ containers, error: null });
    });
  });

class DockerSource {
  constructor(options = {}) {
    if (!options.containerId) throw new Error('DockerSource requires containerId');
    this.containerId = options.containerId;
    this.containerName = options.containerName || options.containerId;
    this.since = options.since || null; // ISO timestamp or '1m' style
    this.sourceId = options.sourceId || `docker:${nanoid(8)}`;
    this.name = options.name || `docker:${this.containerName}`;
    this.spawnFn = options.spawnFn || spawn; // injectable for tests

    this._child = null;
    this._running = false;
    this._paused = false;
    this._lineBuffer = '';
    this._handlers = null;
  }

  start(handlers) {
    this._handlers = handlers || {};
    this.onState('starting');

    const args = ['logs', '--follow', '--timestamps'];
    if (this.since) args.push('--since', String(this.since));
    args.push(this.containerId);

    let child;
    try {
      child = this.spawnFn(DOCKER_BIN, args, { windowsHide: true, shell: isWindows });
    } catch (err) {
      this.onState('error');
      this.onError(err);
      return;
    }
    if (!child || typeof child.on !== 'function') {
      this.onState('error');
      this.onError(new Error('Failed to spawn docker'));
      return;
    }
    this._child = child;
    this._running = true;
    this.onState('running');

    // docker logs merges stdout/stderr when --follow; we tag everything as
    // 'stdout' but keep stderr visible by also listening to child.stderr.
    const ingest = (chunk) => {
      this._lineBuffer += chunk.toString('utf8');
      let idx;
      while ((idx = this._lineBuffer.indexOf('\n')) !== -1) {
        const line = this._lineBuffer.slice(0, idx).replace(/\r$/, '');
        this._lineBuffer = this._lineBuffer.slice(idx + 1);
        if (!this._paused) this.onLine(line, { stream: 'docker' });
      }
    };
    child.stdout?.on('data', ingest);
    child.stderr?.on('data', ingest);

    child.on('error', (err) => {
      this._running = false;
      this.onState('error');
      this.onError(err);
    });
    child.on('close', (code) => {
      this._running = false;
      this._exitCode = code;
      this.onState('exited');
    });
  }

  pause() { this._paused = true; this.onState('paused'); }
  resume() { this._paused = false; this.onState(this._running ? 'running' : 'exited'); }
  isPaused() { return this._paused; }

  getState() {
    return {
      sourceId: this.sourceId,
      type: 'docker',
      name: this.name,
      containerId: this.containerId,
      containerName: this.containerName,
      running: this._running,
      paused: this._paused,
      exitCode: this._exitCode || null
    };
  }

  stop() {
    if (this._child && this._running) {
      try { this._child.kill('SIGTERM'); } catch {}
    }
  }

  onLine(line, meta) { this._handlers?.onLine?.(line, meta); }
  onState(state) { this._handlers?.onState?.(state); }
  onError(err) { this._handlers?.onError?.(err); }
}

module.exports = { DockerSource, detectDocker, listContainers };
