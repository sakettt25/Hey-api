/**
 * Structured log parser for the Local Observability feature.
 *
 * Pure logic — no Electron, no fs. Exports a streaming parser (`createLogParser`)
 * plus a stateless single-line parser (`parseLogLine`) so it can be unit tested
 * in isolation and reused by any log-source adapter.
 *
 * Supported formats (auto-detected per line):
 *   1. JSON Lines / ndjson
 *   2. Common Java / Spring Boot (`yyyy-MM-dd HH:mm:ss.SSS LEVEL pid --- [thread] logger : msg`)
 *   3. Timestamped Node.js / Rails (`[ISO] LEVEL: msg` or `ISO LEVEL msg`)
 *   4. Plain text (fallback) — kept verbatim, no metadata inferred
 *
 * Multiline Java/stack-trace continuations are folded into the previous entry
 * rather than emitted as unrelated error lines. A continuation is detected when
 * the current line does NOT start with a recognisable "log start" pattern AND a
 * previous entry exists that is still "open" (most recently a Java/Spring line,
 * or an entry whose message ended with an exception indicator).
 *
 * Normalized entry shape (see `normalizeEntry`):
 *   {
 *     id, timestamp(ms|null), severity('TRACE'|'DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL'|null),
 *     level(raw|string|null), message(string), service(string|null), pid(string|number|null),
 *     requestId(string|null), traceId(string|null), spanId(string|null),
 *     logger(string|null), exception({type,message,stack}|null), fields({}),
 *     raw(string), isContinuation(bool)
 *   }
 *
 * Unknown formats are still returned (as plain text). Unrecognised fields are
 * never discarded — they are preserved in `fields`. Missing metadata is never
 * invented.
 */

const { nanoid } = require('nanoid');

const SEVERITIES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

const normalizeSeverity = (raw) => {
  if (!raw) return null;
  const upper = String(raw).toUpperCase().trim();
  // Map common aliases.
  if (upper === 'WARNING') return 'WARN';
  if (upper === 'ERR' || upper === 'SEVERE' || upper === 'CRITICAL' || upper === 'FATAL') return upper === 'SEVERE' ? 'ERROR' : upper === 'CRITICAL' ? 'ERROR' : upper;
  if (SEVERITIES.includes(upper)) return upper;
  // Spring uses 4-letter levels; accept them.
  if (upper === 'TRACE') return 'TRACE';
  return SEVERITIES.includes(upper) ? upper : null;
};

// ─── Java / Spring Boot ────────────────────────────────────────────────────
// 2024-01-02 15:04:05.123  INFO 12345 --- [main] com.pkg.Class : message
// 2024-01-02T15:04:05.123+00:00  WARN 12345 --- [http-nio-8080-exec-1] c.p.Class$Inner : msg
const JAVA_LOG_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL|WARNING)\s+(\d+)?\s*---\s*(?:\[([^\]]*)\])?\s*([^:]*?)\s*:\s?(.*)$/;

// Lines that are clearly stack-trace continuations of a Java exception. This
// also matches a bare fully-qualified exception class name on its own line
// (e.g. `java.lang.NullPointerException`) so the exception header itself is
// folded into the preceding ERROR/WARN entry rather than emitted as a new log.
const JAVA_CONTINUATION_RE = /^\s+at\s|^\s*\.\.\.\s|^Caused by:|^Suppressed:|^\t|^[\w.$]+\.(?:Exception|Error)(?:\s|:|$)/;

// ─── Node / Rails / generic timestamped ─────────────────────────────────────
// [2024-01-02T15:04:05.123Z] LEVEL: message
// 2024-01-02T15:04:05.123Z LEVEL message
// 2024-01-02 15:04:05.123 LEVEL message
const BRACKET_TS_RE = /^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\]\s*(\w+)?\s*:?\s*(.*)$/;
const BARE_TS_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(\S+)\s+(.*)$/;

const parseTimestamp = (raw) => {
  if (!raw) return null;
  const normalized = String(raw).replace(',', '.');
  const ms = Date.parse(normalized.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized);
  return Number.isNaN(ms) ? null : ms;
};

// ─── JSON field name normalization ──────────────────────────────────────────
// Maps a wide range of common field names to our internal representation.
const FIELD_ALIASES = {
  timestamp: ['timestamp', 'time', '@timestamp', 'ts', 'date', 'datetime', 'log_time', 'logtime'],
  severity: ['level', 'severity', 'levelname', 'loglevel', 'priority', 'severity_text'],
  message: ['message', 'msg', 'log', 'event', 'text', 'content'],
  service: ['service', 'serviceName', 'service_name', 'app', 'application', 'component', 'host'],
  pid: ['pid', 'processId', 'process_id', 'process', 'tid', 'thread'],
  requestId: ['requestId', 'request_id', 'reqId', 'req_id', 'xRequestId', 'x_request_id', 'correlationId', 'correlation_id', 'cid'],
  traceId: ['traceId', 'trace_id', 'traceparent', 'traceID'],
  spanId: ['spanId', 'span_id', 'spanID'],
  logger: ['logger', 'loggerName', 'logger_name', 'name', 'class', 'class_name', 'className'],
  exceptionType: ['exceptionType', 'exception_type', 'errorType', 'error_type'],
  exceptionMessage: ['exceptionMessage', 'exception_message', 'errorMessage', 'error_message'],
  stack: ['stack', 'stackTrace', 'stack_trace', 'trace', 'exception', 'errorStack', 'error_stack']
};

const pickFirst = (obj, aliases) => {
  for (const alias of aliases) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, alias)) {
      return obj[alias];
    }
  }
  return undefined;
};

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Extract a traceId/spanId from a W3C traceparent string `00-<traceId>-<spanId>-<flags>`.
const parseTraceparent = (value) => {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('-');
  if (parts.length >= 4 && parts[0] === '00' && /^[0-9a-f]{32}$/i.test(parts[1]) && /^[0-9a-f]{16}$/i.test(parts[2])) {
    return { traceId: parts[1], spanId: parts[2] };
  }
  return null;
};

const normalizeEntry = (partial) => {
  const severity = normalizeSeverity(partial.severity);
  let traceId = partial.traceId || null;
  let spanId = partial.spanId || null;

  // If traceId came in as a traceparent, split it.
  if (!traceId && partial.traceparent) {
    const parsed = parseTraceparent(partial.traceparent);
    if (parsed) { traceId = parsed.traceId; spanId = parsed.spanId; }
  }
  if (traceId && typeof traceId === 'string' && traceparentShape(traceId)) {
    const parsed = parseTraceparent(traceId);
    if (parsed) { traceId = parsed.traceId; spanId = parsed.spanId || spanId; }
  }

  const exception = partial.exceptionType || partial.exceptionMessage || partial.stack
    ? {
      type: partial.exceptionType || null,
      message: partial.exceptionMessage || null,
      stack: Array.isArray(partial.stack) ? partial.stack.join('\n') : (typeof partial.stack === 'string' ? partial.stack : null)
    }
    : null;

  return {
    id: partial.id || nanoid(),
    timestamp: typeof partial.timestamp === 'number' ? partial.timestamp : (partial.timestamp ? parseTimestamp(partial.timestamp) : null),
    severity,
    level: partial.level || null,
    message: partial.message || '',
    service: partial.service || null,
    pid: partial.pid !== undefined ? partial.pid : null,
    requestId: partial.requestId || null,
    traceId: traceId || null,
    spanId: spanId || null,
    logger: partial.logger || null,
    exception,
    fields: partial.fields || {},
    raw: partial.raw || '',
    isContinuation: !!partial.isContinuation
  };
};

const traceparentShape = (s) => /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(s);

// ─── Format-specific line parsers ───────────────────────────────────────────

const tryParseJson = (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isObject(obj)) return null;

  const timestamp = pickFirst(obj, FIELD_ALIASES.timestamp);
  const severity = pickFirst(obj, FIELD_ALIASES.severity);
  const message = pickFirst(obj, FIELD_ALIASES.message);
  const service = pickFirst(obj, FIELD_ALIASES.service);
  const pid = pickFirst(obj, FIELD_ALIASES.pid);
  const requestId = pickFirst(obj, FIELD_ALIASES.requestId);
  let traceId = pickFirst(obj, FIELD_ALIASES.traceId);
  const spanId = pickFirst(obj, FIELD_ALIASES.spanId);
  const logger = pickFirst(obj, FIELD_ALIASES.logger);
  const exceptionType = pickFirst(obj, FIELD_ALIASES.exceptionType);
  const exceptionMessage = pickFirst(obj, FIELD_ALIASES.exceptionMessage);
  const stack = pickFirst(obj, FIELD_ALIASES.stack);

  // traceparent helper: a top-level "traceparent" string beats the parsed fields.
  const traceparent = obj.traceparent;
  let parsedTrace = null;
  if (traceparent && typeof traceparent === 'string') parsedTrace = parseTraceparent(traceparent);
  else if (traceId && typeof traceId === 'string') {
    const tp = parseTraceparent(traceId);
    if (tp) parsedTrace = tp;
  }

  // Build the leftover `fields` object: every key not consumed above.
  const consumed = new Set();
  Object.values(FIELD_ALIASES).forEach((aliases) => aliases.forEach((a) => consumed.add(a)));
  consumed.add('traceparent');
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!consumed.has(k)) fields[k] = v;
  }

  // If "stack" was an object with type/message, fold it in.
  let effExceptionType = exceptionType;
  let effExceptionMessage = exceptionMessage;
  let effStack = stack;
  if (isObject(stack)) {
    effExceptionType = effExceptionType || stack.type || null;
    effExceptionMessage = effExceptionMessage || stack.message || null;
    effStack = stack.stack || null;
  }

  return normalizeEntry({
    timestamp: typeof timestamp === 'number' ? timestamp : (timestamp || null),
    severity,
    level: typeof severity === 'string' ? severity : null,
    message: typeof message === 'string' ? message : (message === undefined ? '' : safeStringify(message)),
    service: typeof service === 'string' ? service : (service === undefined ? null : safeStringify(service)),
    pid: pid === undefined ? null : pid,
    requestId: requestId === undefined ? null : String(requestId),
    traceId: parsedTrace ? parsedTrace.traceId : (traceId === undefined ? null : String(traceId)),
    spanId: parsedTrace ? (parsedTrace.spanId || (spanId === undefined ? null : String(spanId))) : (spanId === undefined ? null : String(spanId)),
    logger: typeof logger === 'string' ? logger : (logger === undefined ? null : String(logger)),
    exceptionType: effExceptionType,
    exceptionMessage: effExceptionMessage,
    stack: effStack,
    fields,
    raw: line
  });
};

const safeStringify = (v) => {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const tryParseJava = (line) => {
  const m = JAVA_LOG_RE.exec(line);
  if (!m) return null;
  const [, ts, level, pid, thread, logger, message] = m;
  // Detect "Exception in thread" style: the message itself may start the exception.
  return normalizeEntry({
    timestamp: ts,
    severity: level,
    level,
    pid: pid || null,
    logger: logger ? logger.trim() : null,
    message: message || '',
    fields: thread ? { thread } : {},
    raw: line
  });
};

const tryParseBracketTs = (line) => {
  const m = BRACKET_TS_RE.exec(line);
  if (!m) return null;
  const [, ts, level, rest] = m;
  return normalizeEntry({
    timestamp: ts,
    severity: level,
    level: level || null,
    message: rest || '',
    raw: line
  });
};

const tryParseBareTs = (line) => {
  const m = BARE_TS_RE.exec(line);
  if (!m) return null;
  const [, ts, level, rest] = m;
  // Only accept if the "level" token looks like a log level, otherwise it's just a plain line.
  if (!normalizeSeverity(level)) return null;
  return normalizeEntry({
    timestamp: ts,
    severity: level,
    level,
    message: rest || '',
    raw: line
  });
};

const parsePlain = (line) =>
  normalizeEntry({
    message: line,
    raw: line
  });

// ─── Public stateless single-line parser ─────────────────────────────────────
/**
 * Parse a single raw log line into a normalized entry. Does NOT handle
 * continuations — use `createLogParser().feed(line)` for streaming.
 * Order matters: JSON first (most structured), then Java, then timestamped,
 * then plain-text fallback.
 */
const parseLogLine = (line) => {
  if (line === null || line === undefined || line === '') return null;
  return (
    tryParseJson(line) ||
    tryParseJava(line) ||
    tryParseBracketTs(line) ||
    tryParseBareTs(line) ||
    parsePlain(line)
  );
};

// ─── Public streaming parser with multiline folding ──────────────────────────
/**
 * Stateful streaming parser. Call `feed(line)` for each line. Returns an
 * array of events:
 *   { kind: 'entry', entry }                     — a complete new entry
 *   { kind: 'continuation', entry, line }       — append `line` to entry.exception.stack
 *   { kind: 'flush', entry }                     — previous entry is now closed (new log start)
 *
 * The caller is responsible for accumulating continuations into the previous
 * entry before displaying it. This keeps the parser pure (no buffering of
 * partial entries internally beyond the "last open entry" reference).
 */
const createLogParser = () => {
  let openEntry = null;

  const looksLikeContinuation = (line) => {
    if (!openEntry) return false;
    // Java/Spring exception continuations.
    if (JAVA_CONTINUATION_RE.test(line)) return true;
    // JSON-array stack frames ("    at com.x.Y(Z:1)") also count.
    if (/^\s+at\s/.test(line)) return true;
    // Lines that start with whitespace and the open entry has an exception.
    if (openEntry.exception && /^\s+/.test(line)) return true;
    return false;
  };

  const startsNewLog = (line) => {
    if (line.trim() === '') return false;
    if (tryParseJson(line)) return true;
    if (JAVA_LOG_RE.test(line)) return true;
    if (BRACKET_TS_RE.test(line)) return true;
    if (BARE_TS_RE.test(line) && normalizeSeverity(BARE_TS_RE.exec(line)?.[2])) return true;
    // Plain line that is NOT a continuation starts a new (plain) log.
    return true;
  };

  return {
    feed(line) {
      const parsed = parseLogLine(line);
      if (!parsed) return [];

      const events = [];

      // If we have an open entry and this line is a continuation, fold it in.
      if (openEntry && looksLikeContinuation(line)) {
        const stack = openEntry.exception?.stack
          ? openEntry.exception.stack + '\n' + line
          : line;
        openEntry.exception = openEntry.exception || { type: null, message: null, stack: null };
        openEntry.exception.stack = stack;
        // Append to message too, so a quick glance shows the trace.
        openEntry.message = openEntry.message + '\n' + line;
        return [{ kind: 'continuation', entry: openEntry, line }];
      }

      // Otherwise, the open entry is closed and we start a new one.
      if (openEntry) {
        events.push({ kind: 'flush', entry: openEntry });
      }
      openEntry = parsed;
      events.push({ kind: 'entry', entry: parsed });
      return events;
    },

    /** Flush any open entry at EOF / source close. */
    end() {
      if (!openEntry) return [];
      const e = openEntry;
      openEntry = null;
      return [{ kind: 'flush', entry: e }];
    },

    /** Reset without flushing (used when a source is cleared). */
    reset() {
      openEntry = null;
    },

    get openEntry() {
      return openEntry;
    }
  };
};

module.exports = {
  parseLogLine,
  createLogParser,
  normalizeSeverity,
  parseTimestamp,
  parseTraceparent,
  SEVERITIES
};
