/**
 * ObservabilityManager — the central coordinator for the Local Observability
 * feature in the Electron main process.
 *
 * Owns:
 *   - A map of active log sources (file tailers, process sources, docker).
 *   - One streaming parser per source (so multiline folding is per-source).
 *   - A bounded global ring buffer of recent normalized entries (for the "all
 *     incoming logs" view) plus a small per-source buffer.
 *   - A DebugSessionManager for request↔log correlation.
 *   - Redaction config (built-in + user patterns).
 *
 * Pushes (via the `emit` callback wired by the IPC layer):
 *   main:observability:log-entry    { entry }
 *   main:observability:source-state { sourceId, state, source }
 *   main:observability:session       { session }
 *
 * Memory bounds:
 *   - MAX_ENTRIES global ring (default 5000). Oldest dropped.
 *   - MAX_ENTRIES_PER_SOURCE per-source ring (default 1000).
 *   - MAX_MESSAGE_BYTES per emitted message (truncated with a marker so the
 *     renderer never holds a giant string).
 *
 * Pure Node — no Electron. The `emit` callback is injected so this is fully
 * testable with a stub emitter.
 */

const { nanoid } = require('nanoid');
const { createLogParser, parseLogLine } = require('./parser');
const { redactEntry } = require('./redactor');
const { FileTailSource } = require('./file-tailer');
const { ProcessSource } = require('./process-source');
const { DockerSource, detectDocker, listContainers } = require('./docker-source');
const { DebugSessionManager } = require('./debug-sessions');

const MAX_ENTRIES = 5000;
const MAX_ENTRIES_PER_SOURCE = 1000;
const MAX_MESSAGE_BYTES = 64 * 1024;

const truncateMessage = (entry) => {
  if (!entry || typeof entry.message !== 'string') return entry;
  const buf = Buffer.byteLength(entry.message, 'utf8');
  if (buf <= MAX_MESSAGE_BYTES) return entry;
  const cut = Buffer.from(entry.message, 'utf8').subarray(0, MAX_MESSAGE_BYTES - 32).toString('utf8');
  return { ...entry, message: cut + '\n[truncated]' };
};

class ObservabilityManager {
  constructor(options = {}) {
    this.emit = options.emit || (() => {});
    this.maxEntries = options.maxEntries || MAX_ENTRIES;
    this.maxEntriesPerSource = options.maxEntriesPerSource || MAX_ENTRIES_PER_SOURCE;
    this.debugSessions = new DebugSessionManager();
    this.correlationHeaderName = options.correlationHeaderName || 'X-Request-ID';
    this.timeWindowMs = options.timeWindowMs || 2000;
    this.redactionExtraPatterns = options.redactionExtraPatterns || [];

    this._entries = []; // global ring
    this._sources = new Map(); // sourceId → { source, parser, state, entries, meta }
    this._sourceIdByRequest = new Map(); // (not used in v1; for future)
  }

  // ─── Source management ───────────────────────────────────────────────────────

  async addFileSource(opts = {}) {
    const sourceId = opts.sourceId || `file:${nanoid(8)}`;
    const tail = new FileTailSource({
      filePath: opts.filePath,
      sourceId,
      name: opts.name,
      startFromEnd: opts.startFromEnd !== false,
      loadRecentLines: !!opts.loadRecentLines,
      recentLinesCount: opts.recentLinesCount,
      pollMs: opts.pollMs
    });
    this._registerSource(tail, { type: 'file', filePath: opts.filePath, name: opts.name || tail.name });
    await this._startSource(sourceId);
    return this.getSource(sourceId);
  }

  addProcessSource(opts = {}) {
    const sourceId = opts.sourceId || `process:${nanoid(8)}`;
    const proc = new ProcessSource({
      command: opts.command,
      args: opts.args,
      cwd: opts.cwd,
      env: opts.env,
      sourceId,
      name: opts.name
    });
    this._registerSource(proc, { type: 'process', command: opts.command, args: opts.args, cwd: opts.cwd, name: opts.name || proc.name });
    proc.start(this._sourceHandlers(sourceId, { stream: 'stdout' }));
    return this.getSource(sourceId);
  }

  async addDockerSource(opts = {}) {
    const sourceId = opts.sourceId || `docker:${nanoid(8)}`;
    const docker = new DockerSource({
      containerId: opts.containerId,
      containerName: opts.containerName,
      since: opts.since,
      sourceId,
      name: opts.name
    });
    this._registerSource(docker, { type: 'docker', containerId: opts.containerId, containerName: opts.containerName, name: opts.name || docker.name });
    docker.start(this._sourceHandlers(sourceId, { stream: 'docker' }));
    return this.getSource(sourceId);
  }

  _registerSource(source, meta) {
    const sourceId = source.sourceId;
    this._sources.set(sourceId, {
      source,
      parser: createLogParser(),
      state: 'starting',
      entries: [],
      meta: { ...meta }
    });
  }

  async _startSource(sourceId) {
    const rec = this._sources.get(sourceId);
    if (!rec) return;
    await rec.source.start(this._sourceHandlers(sourceId, {}));
  }

  _sourceHandlers(sourceId, defaultMeta) {
    return {
      onLine: (line, meta) => this._handleRawLine(sourceId, line, meta || defaultMeta),
      onState: (state) => this._handleSourceState(sourceId, state),
      onError: (err) => this._handleSourceError(sourceId, err),
      onExit: (info) => this._handleSourceExit(sourceId, info)
    };
  }

  // ─── Ingestion pipeline: raw line → parse → redact → correlate → emit ───────

  _handleRawLine(sourceId, line, meta) {
    const rec = this._sources.get(sourceId);
    if (!rec) return;

    const events = rec.parser.feed(line);
    for (const ev of events) {
      if (ev.kind === 'entry' || ev.kind === 'continuation') {
        // continuations update the previous entry; for emit simplicity we only
        // forward 'entry' and 'flush' so the renderer gets finalized entries,
        // but for a live console we also forward continuations so the stack
        // trace grows visibly. We forward continuations too, with the same id.
        this._emitEntry(sourceId, ev.entry, meta, ev.kind === 'continuation');
      } else if (ev.kind === 'flush') {
        // The flushed entry was already emitted as 'entry' earlier; nothing new.
      }
    }
  }

  _emitEntry(sourceId, rawEntry, meta, isContinuation) {
    // Tag with source metadata.
    const rec = this._sources.get(sourceId);
    if (!rec) return;
    const tagged = {
      ...rawEntry,
      source: { id: sourceId, type: rec.meta.type, name: rec.meta.name },
      stream: meta?.stream || null,
      arrivalTime: Date.now()
    };
    if (typeof tagged.timestamp !== 'number') tagged.timestamp = tagged.arrivalTime;

    // Truncate giant messages before redaction (redaction cost scales with len).
    const safe = redactEntry(truncateMessage(tagged), {
      extraPatterns: this.redactionExtraPatterns
    });

    // Correlate to active sessions, attach ids.
    const { exact, potential } = this.debugSessions.matchLogToSessions(safe);
    safe.sessions = { exact, potential };

    // Bounded global + per-source rings.
    this._pushEntry(this._entries, safe, this.maxEntries);
    this._pushEntry(rec.entries, safe, this.maxEntriesPerSource);

    // Emit to renderer. For continuations we send an update with the same id
    // so the renderer can replace the row in place.
    this.emit('main:observability:log-entry', { entry: safe, isContinuation });
  }

  _pushEntry(arr, entry, cap) {
    arr.push(entry);
    if (arr.length > cap) arr.splice(0, arr.length - cap);
  }

  // ─── Source state plumbing ───────────────────────────────────────────────────

  _handleSourceState(sourceId, state) {
    const rec = this._sources.get(sourceId);
    if (!rec) return;
    rec.state = state;
    this.emit('main:observability:source-state', { sourceId, state, source: this.getSource(sourceId) });
  }

  _handleSourceError(sourceId, err) {
    this.emit('main:observability:source-error', {
      sourceId,
      message: err?.message || String(err),
      code: err?.code || null
    });
  }

  _handleSourceExit(sourceId, info) {
    const rec = this._sources.get(sourceId);
    if (!rec) return;
    this.emit('main:observability:source-exit', { sourceId, exitCode: info?.exitCode, signal: info?.signal });
  }

  // ─── Source control ─────────────────────────────────────────────────────────

  pauseSource(sourceId) {
    const rec = this._sources.get(sourceId);
    if (rec?.source?.pause) rec.source.pause();
  }

  resumeSource(sourceId) {
    const rec = this._sources.get(sourceId);
    if (rec?.source?.resume) rec.source.resume();
  }

  async removeSource(sourceId) {
    const rec = this._sources.get(sourceId);
    if (!rec) return false;
    try {
      await rec.source.stop?.();
    } catch {}
    rec.parser.reset();
    this._sources.delete(sourceId);
    this.emit('main:observability:source-removed', { sourceId });
    return true;
  }

  listSources() {
    const out = [];
    for (const [, rec] of this._sources) {
      out.push({ ...rec.meta, ...rec.source.getState?.(), state: rec.state });
    }
    return out;
  }

  getSource(sourceId) {
    const rec = this._sources.get(sourceId);
    if (!rec) return null;
    return { ...rec.meta, ...rec.source.getState?.(), state: rec.state };
  }

  // ─── Entry queries + export ─────────────────────────────────────────────────

  getEntries(filter = {}) {
    return this._applyFilter(this._entries, filter);
  }

  getEntriesForSession(sessionId) {
    const session = this.debugSessions.getSession(sessionId);
    if (!session) return [];
    const ids = new Set([...session.matchedLogIds, ...session.potentialLogIds]);
    return this._entries.filter((e) => ids.has(e.id));
  }

  exportEntries(entries, opts = {}) {
    // Returns a JSON string of the given (already-redacted) entries. We never
    // include unredacted data here — all entries are redacted at ingest time.
    const payload = (entries || this._entries).map((e) => ({
      timestamp: e.timestamp,
      severity: e.severity,
      level: e.level,
      message: e.message,
      service: e.service,
      logger: e.logger,
      requestId: e.requestId,
      traceId: e.traceId,
      spanId: e.spanId,
      exception: e.exception,
      source: e.source,
      stream: e.stream,
      raw: e.raw,
      fields: e.fields,
      sessions: e.sessions
    }));
    return JSON.stringify(payload, null, opts.pretty ? 2 : 0);
  }

  _applyFilter(entries, filter) {
    if (!filter || Object.keys(filter).length === 0) return entries.slice();
    const {
      severities,
      text,
      sourceIds,
      services,
      requestId,
      traceId,
      spanId,
      sessionId,
      timeFrom,
      timeTo,
      onlyErrorsAndWarnings
    } = filter;
    const sev = severities ? new Set(severities) : null;
    const src = sourceIds ? new Set(sourceIds) : null;
    const svc = services ? new Set(services) : null;
    const lowerText = text ? text.toLowerCase() : null;

    let matchedIds = null;
    if (sessionId) {
      const session = this.debugSessions.getSession(sessionId);
      if (session) matchedIds = new Set([...session.matchedLogIds, ...session.potentialLogIds]);
    }

    return entries.filter((e) => {
      if (sev && e.severity && !sev.has(e.severity)) return false;
      if (onlyErrorsAndWarnings && e.severity !== 'ERROR' && e.severity !== 'WARN' && e.severity !== 'FATAL') return false;
      if (src && e.source?.id && !src.has(e.source.id)) return false;
      if (svc && e.service && !svc.has(e.service)) return false;
      if (requestId && e.requestId !== requestId && !(e.message || '').includes(requestId)) return false;
      if (traceId && e.traceId !== traceId) return false;
      if (spanId && e.spanId !== spanId) return false;
      if (matchedIds && !matchedIds.has(e.id)) return false;
      if (typeof timeFrom === 'number' && (e.timestamp || 0) < timeFrom) return false;
      if (typeof timeTo === 'number' && (e.timestamp || 0) > timeTo) return false;
      if (lowerText) {
        const hay = `${e.message || ''} ${e.raw || ''} ${e.logger || ''} ${e.service || ''}`.toLowerCase();
        if (!hay.includes(lowerText)) return false;
      }
      return true;
    });
  }

  // ─── Debug session lifecycle (called from the HTTP IPC path) ───────────────

  createSessionForRequest(opts = {}) {
    return this.debugSessions.createSession({
      requestUid: opts.requestUid,
      itemUid: opts.itemUid,
      collectionUid: opts.collectionUid,
      method: opts.method,
      url: opts.url,
      correlationHeaderName: opts.correlationHeaderName || this.correlationHeaderName,
      correlationId: opts.correlationId,
      timeWindowMs: typeof opts.timeWindowMs === 'number' ? opts.timeWindowMs : this.timeWindowMs
    });
  }

  recordRequestSent(sessionId, payload) {
    this.debugSessions.requestSent(sessionId, payload);
    this.emit('main:observability:session', { session: this.debugSessions.getSession(sessionId) });
  }

  recordResponseReceived(sessionId, payload) {
    this.debugSessions.responseReceived(sessionId, payload);
    this.emit('main:observability:session', { session: this.debugSessions.getSession(sessionId) });
  }

  cancelSession(sessionId) {
    this.debugSessions.cancelSession(sessionId);
    this.emit('main:observability:session', { session: this.debugSessions.getSession(sessionId) });
  }

  getSessions(limit = 50) {
    return this.debugSessions.getRecentSessions(limit);
  }

  getSession(id) {
    return this.debugSessions.getSession(id);
  }

  // ─── Config ────────────────────────────────────────────────────────────────

  updateConfig(opts = {}) {
    if (typeof opts.correlationHeaderName === 'string') this.correlationHeaderName = opts.correlationHeaderName;
    if (typeof opts.timeWindowMs === 'number') this.timeWindowMs = opts.timeWindowMs;
    if (Array.isArray(opts.redactionExtraPatterns)) this.redactionExtraPatterns = opts.redactionExtraPatterns;
  }

  // ─── Docker helpers ────────────────────────────────────────────────────────

  static detectDocker = detectDocker;
  static listContainers = listContainers;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async shutdown() {
    const ids = Array.from(this._sources.keys());
    await Promise.allSettled(ids.map((id) => this.removeSource(id)));
    this._entries.length = 0;
    this.debugSessions.clear();
  }
}

module.exports = {
  ObservabilityManager,
  MAX_ENTRIES,
  MAX_ENTRIES_PER_SOURCE,
  MAX_MESSAGE_BYTES,
  parseLogLine
};
