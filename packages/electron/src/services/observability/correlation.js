/**
 * Log-to-request correlation engine for the Local Observability feature.
 *
 * Matches a normalized log entry to debug sessions. Two strengths:
 *
 *   - EXACT: the log carries an identifier that equals the session's
 *     correlation id, request id, or trace id. Reliable — these are the
 *     matches the user can trust.
 *   - POTENTIAL: the log arrived within the session's time window but carries
 *     no matching identifier. These are explicitly labelled as potential so
 *     the UI can show them differently and the user is not misled.
 *
 * Safeguards (per task requirements):
 *   - We NEVER claim a log belongs to a request merely because it arrived
 *     nearby in time. Time-only matches are always classified as "potential".
 *   - Explicit ids always win and always label the match as exact.
 *   - The time window is taken from each session's `timeWindowMs` (configurable
 *     per-session, default 2000ms), measured around [startedAt, completedAt].
 *   - We also scan the log's raw text and message for the session's
 *     correlation id substring — this catches plain-text logs that print the
 *     request id (e.g. `GET /users  [reqId=dbg_xxxx]`) without structured
 *     fields. To avoid false positives, the substring scan only accepts ids
 *     with a recognisable prefix (`dbg_`) or a length >= 12 to reduce the
 *     chance of short-id collisions.
 *
 * Pure logic — no Electron. Fully unit-tested.
 */

const MIN_ID_LENGTH_FOR_SUBSTRING_MATCH = 12;

const isPlausibleId = (id) => {
  if (typeof id !== 'string') return false;
  if (id.length < MIN_ID_LENGTH_FOR_SUBSTRING_MATCH) return false;
  // Allow our own prefix and typical uuid/hex ids.
  if (id.startsWith('dbg_')) return true;
  return /^[0-9a-fA-F-]{12,}$/.test(id);
};

/**
 * @param {object} entry normalized log entry (see parser.js)
 * @param {object[]} sessions debug sessions (see debug-sessions.js)
 * @returns {{ exact: string[], potential: string[] }} session ids
 */
const correlateLogToSessions = (entry, sessions) => {
  if (!entry || !sessions || !sessions.length) return { exact: [], potential: [] };

  const exact = new Set();
  const potential = new Set();

  const logTime = typeof entry.timestamp === 'number' ? entry.timestamp : null;
  const logRequestId = entry.requestId || null;
  const logTraceId = entry.traceId || null;

  for (const s of sessions) {
    let matchedExact = false;

    // 1. Explicit identifier matches.
    if (logRequestId && (logRequestId === s.correlationId || logRequestId === s.requestUid)) {
      exact.add(s.id);
      matchedExact = true;
    }
    if (logTraceId && logTraceId === s.traceId) {
      exact.add(s.id);
      matchedExact = true;
    }

    // 2. Substring scan of raw/message for the session's correlation id
    //    (only for plausible ids, to avoid short-string false positives).
    if (!matchedExact && isPlausibleId(s.correlationId)) {
      const cid = s.correlationId;
      const hay = `${entry.message || ''}\n${entry.raw || ''}`;
      if (hay.includes(cid)) {
        exact.add(s.id);
        matchedExact = true;
      }
    }

    // 3. Time-window potential match (only if not exact and we have a log time).
    if (!matchedExact && logTime !== null) {
      const start = s.startedAt - (s.timeWindowMs || 0);
      const end = (s.completedAt || Date.now()) + (s.timeWindowMs || 0);
      if (logTime >= start && logTime <= end) {
        potential.add(s.id);
      }
    }
  }

  return { exact: Array.from(exact), potential: Array.from(potential) };
};

module.exports = { correlateLogToSessions, isPlausibleId, MIN_ID_LENGTH_FOR_SUBSTRING_MATCH };
