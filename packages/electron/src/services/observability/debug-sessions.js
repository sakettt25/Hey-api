/**
 * Debug-session manager for the Local Observability feature.
 *
 * A debug session ties one HTTP request (sent from Hey API) to the log lines
 * the backend produced while handling it. Sessions are created in the main
 * process when `send-http-request` arrives, before the request goes on the
 * wire, so the correlation header value (the session id) can be propagated
 * and matched against incoming logs.
 *
 * Lifecycle:
 *   - createSession({ itemUid, collectionUid, requestUid, method, url,
 *                     correlationHeaderName, correlationId, timeWindowMs })
 *       → returns the new session. The correlation id defaults to a fresh id.
 *   - requestSent(sessionId, { timestamp })
 *   - responseReceived(sessionId, { status, duration, completedAt })
 *   - closeSession(sessionId)  — marks completed; keeps it for history
 *   - cancelSession(sessionId)
 *   - getSession(id), getActiveSessions(), getRecentSessions()
 *   - matchLogToSessions(entry) — delegates to correlation.js, returns matches
 *
 * Sessions are kept in a bounded ring (MAX_SESSIONS). When the ring fills, the
 * oldest are evicted. The correlator's matched/potential log id lists are also
 * capped per session (MAX_MATCHES_PER_SESSION).
 *
 * Pure logic — no Electron. Fully testable.
 */

const { nanoid } = require('nanoid');
const { correlateLogToSessions } = require('./correlation');

const MAX_SESSIONS = 200;
const MAX_MATCHES_PER_SESSION = 500;

const newSessionId = () => `dbg_${nanoid(12)}`;

class DebugSessionManager {
  constructor() {
    this._sessions = new Map(); // id → session
    this._order = []; // LRU order, oldest first
  }

  createSession(opts = {}) {
    const id = opts.id || newSessionId();
    const now = Date.now();
    const session = {
      id,
      requestUid: opts.requestUid || null,
      itemUid: opts.itemUid || null,
      collectionUid: opts.collectionUid || null,
      method: opts.method || null,
      url: opts.url || null,
      correlationHeaderName: opts.correlationHeaderName || 'X-Request-ID',
      correlationId: opts.correlationId || id,
      startedAt: opts.startedAt || now,
      requestSentAt: null,
      completedAt: null,
      status: 'running', // 'running' | 'completed' | 'failed' | 'cancelled'
      responseStatus: null,
      duration: null,
      timeWindowMs: typeof opts.timeWindowMs === 'number' ? opts.timeWindowMs : 2000,
      matchedLogIds: [],
      potentialLogIds: []
    };
    this._sessions.set(id, session);
    this._order.push(id);
    this._evict();
    return session;
  }

  _evict() {
    while (this._order.length > MAX_SESSIONS) {
      const oldest = this._order.shift();
      this._sessions.delete(oldest);
    }
  }

  requestSent(sessionId, payload = {}) {
    const s = this._sessions.get(sessionId);
    if (!s) return;
    s.requestSentAt = payload.timestamp || Date.now();
  }

  responseReceived(sessionId, payload = {}) {
    const s = this._sessions.get(sessionId);
    if (!s) return;
    s.completedAt = payload.completedAt || Date.now();
    s.responseStatus = payload.status ?? null;
    s.duration = typeof payload.duration === 'number' ? payload.duration : null;
    s.status = payload.failed ? 'failed' : 'completed';
  }

  cancelSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return;
    if (s.status === 'running') {
      s.status = 'cancelled';
      s.completedAt = Date.now();
    }
  }

  closeSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return;
    if (s.status === 'running') {
      s.status = 'completed';
      s.completedAt = s.completedAt || Date.now();
    }
  }

  getSession(id) {
    return this._sessions.get(id) || null;
  }

  getActiveSessions() {
    return Array.from(this._sessions.values()).filter((s) => s.status === 'running');
  }

  getRecentSessions(limit = 50) {
    return this._order.slice(-limit).map((id) => this._sessions.get(id)).filter(Boolean);
  }

  /**
   * Match a normalized log entry to active/recent sessions. Records the match
   * on the session (capped) and returns the session ids + match strength.
   *
   * @returns { exact: string[], potential: string[] }  session ids
   */
  matchLogToSessions(entry) {
    const sessions = Array.from(this._sessions.values());
    const { exact, potential } = correlateLogToSessions(entry, sessions);
    for (const id of exact) {
      const s = this._sessions.get(id);
      if (s && s.matchedLogIds.length < MAX_MATCHES_PER_SESSION) {
        s.matchedLogIds.push(entry.id);
      }
    }
    for (const id of potential) {
      const s = this._sessions.get(id);
      if (s && s.potentialLogIds.length < MAX_MATCHES_PER_SESSION) {
        s.potentialLogIds.push(entry.id);
      }
    }
    return { exact, potential };
  }

  clear() {
    this._sessions.clear();
    this._order = [];
  }
}

module.exports = { DebugSessionManager, MAX_SESSIONS, MAX_MATCHES_PER_SESSION, newSessionId };
