/**
 * Secret redaction + untrusted-content sanitization for the Local Observability
 * feature. Applied to every normalized log entry before it is pushed to the
 * renderer or written to an export.
 *
 * Pure logic — no Electron, no fs — so it is fully unit-testable.
 *
 * Two responsibilities:
 *
 * 1. ANSI / terminal-escape sanitization. Log files from interactive processes
 *    can contain control sequences that, if rendered naively, could be used to
 *    mislead or execute actions in a terminal (e.g. OSC clipboard or title
 *    escapes). We strip ALL control sequences and non-printable control chars
 *    except common whitespace (\t, \n, \r).
 *
 * 2. Secret redaction. Replaces values that match known secret patterns with a
 *    fixed placeholder. Built-in detectors cover:
 *      - Bearer / Basic authorization header values
 *      - `Authorization: <scheme> <token>` and `authorization:` headers
 *      - `password=...`, `passwd=...`, `pwd=...`
 *      - `api_key=...`, `apikey=...`, `x-api-key: ...`, `api-key: ...`
 *      - `token=...`, `access_token=...`, `refresh_token=...`, `id_token=...`
 *      - `secret=...`, `client_secret=...`
 *      - `set-cookie: ...` / `Cookie: ...`
 *      - AWS-style `AKIA...` access key ids and `aws_secret_access_key=...`
 *      - Private key PEM blocks
 *    Plus user-configurable extra regexes (added on top, never replacing the
 *    built-ins).
 *
 * Redaction is conservative: it only rewrites the *value* portion after a
 * known key, leaving the key itself visible so the developer can still see
 * "authorization: [REDACTED]". It operates on the `message`, `exception.*`,
 * and stringified `fields.*` values. The original `raw` line is also redacted
 * in the copy that leaves the main process (the in-memory original is left
 * untouched inside the adapter so the user could — in a future feature —
 * toggle "show raw including secrets", but that path is not exposed in v1).
 */

const { nanoid } = require('nanoid');

const REDACTED = '[REDACTED]';

// ─── ANSI / control sequence sanitization ────────────────────────────────────
// Strips CSI, OSC, DCS, and other C1 control sequences, plus other non-printable
// control characters. Keeps \t \n \r.
// CSI:  ESC [ <params 0x30-0x3F> <intermediate 0x20-0x2F> <final 0x40-0x7E>
// OSC:  ESC ] ... (BEL or ST = ESC \)
// DCS/SOS/PM/APC: ESC P/X/^/_ ... ST
// Two-char ESC sequences: ESC <single byte>
const ANSI_RE = /\x1b(?:\[[0-9;?]*[ -\/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[PX^_][^\x1b]*\x1b\\|[ -\/]*[@-~])/g;
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

const sanitizeText = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(ANSI_RE, '').replace(CONTROL_CHARS_RE, '');
};

// ─── Secret patterns ─────────────────────────────────────────────────────────
// Each pattern is anchored on a key prefix so we only redact the *value* after a
// recognized secret keyword. Patterns are case-insensitive. The capture group is
// the value to replace with [REDACTED].
const BUILTIN_PATTERNS = [
  // Authorization header (full header form): `Authorization: Bearer xxx` / `Authorization: Basic xxx`
  /\b(authorization|x-authorization)\s*[:=]\s*(bearer|basic|dearer|token|jwt)?\s*([\w\-\.=:+\/]+)\b/gi,
  // Bare bearer tokens in text: `Bearer eyJ...`
  /\b(bearer)\s+([\w\-\.=:+\/]{8,})\b/gi,
  // password / passwd / pwd = "..." or : "..."
  /\b(passwd|password|pwd)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
  // api key variants
  /\b(api[_-]?key|x[_-]?api[_-]?key)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
  // generic token / secret values
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret[_-]?key|secret)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
  // set-cookie / cookie headers — redact the value entirely
  /\b(set[_-]?cookie|cookie)\s*[:=]\s*[^\r\n]*/gi,
  // AWS access key id (AKIA...) — redact just the key id.
  /\b(AKIA[0-9A-Z]{16})\b/g,
  // AWS secret access key assignment
  /\b(aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
  // private key PEM blocks
  /-----BEGIN ([A-Z ]+)?PRIVATE KEY-----[\s\S]*?-----END ([A-Z ]+)?PRIVATE KEY-----/g
];

const redactString = (str, extraPatterns = []) => {
  if (typeof str !== 'string' || str.length === 0) return str;
  let out = str;
  const all = extraPatterns.length ? BUILTIN_PATTERNS.concat(extraPatterns) : BUILTIN_PATTERNS;
  for (const re of all) {
    // Re-instantiate the regex because .match is stateful (lastIndex).
    const pattern = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    out = out.replace(pattern, (match, ...args) => {
      // If the pattern has a capture group for the value, replace only that group;
      // otherwise replace the whole match.
      const groups = args.slice(0, -2); // drop capture object + index
      if (groups.length === 0) return REDACTED;
      // Rebuild the match, redacting the LAST capture group (the value).
      let rebuilt = match;
      // Simple approach: replace the last captured group substring with REDACTED,
      // only the first occurrence in the match (the value).
      const value = groups[groups.length - 1];
      if (value && typeof value === 'string' && rebuilt.includes(value)) {
        rebuilt = rebuilt.replace(value, REDACTED);
      } else if (groups.length >= 2) {
        // For bearer-style captures: group1=scheme, group2=token → redact token.
        const token = groups[groups.length - 1];
        if (token && rebuilt.includes(token)) rebuilt = rebuilt.replace(token, REDACTED);
      }
      return rebuilt;
    });
  }
  return out;
};

// Redact a value that may be a string, number, boolean, array, or object.
const redactValue = (value, extraPatterns) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value, extraPatterns);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, extraPatterns));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    // Redact by key name too: if the key itself looks secret, redact the value wholesale.
    const keyLower = k.toLowerCase();
    if (SECRET_KEY_RE.test(keyLower)) {
      out[k] = REDACTED;
    } else {
      out[k] = redactValue(v, extraPatterns);
    }
  }
  return out;
};

const SECRET_KEY_RE = /^(authorization|x-authorization|password|passwd|pwd|api[_-]?key|x[_-]?api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret[_-]?key|secret|set[_-]?cookie|cookie|aws[_-]?secret[_-]?access[_-]?key|private[_-]?key)$/i;

/**
 * Redact a normalized log entry in place (returns a new object; the input is
 * not mutated). Also sanitizes ANSI sequences first so escape sequences can
 * never reach a terminal or the DOM.
 *
 * @param {object} entry normalized entry (see parser.js)
 * @param {object} opts
 * @param {string[]} [opts.extraPatterns] additional RegExp source strings
 * @param {boolean} [opts.sanitizeOnly] skip secret redaction (still sanitize)
 * @returns {object} a redacted, sanitized copy
 */
const redactEntry = (entry, opts = {}) => {
  if (!entry) return entry;
  const extraPatterns = (opts.extraPatterns || [])
    .map((src) => {
      try { return new RegExp(src, 'gi'); } catch { return null; }
    })
    .filter(Boolean);

  const sanitize = (s) => (typeof s === 'string' ? sanitizeText(s) : s);
  const redact = (s) => (opts.sanitizeOnly ? sanitize(s) : redactString(sanitize(s), extraPatterns));

  const exception = entry.exception
    ? {
      type: entry.exception.type ? redact(String(entry.exception.type)) : null,
      message: entry.exception.message ? redact(String(entry.exception.message)) : null,
      stack: entry.exception.stack ? redact(String(entry.exception.stack)) : null
    }
    : null;

  const fields = entry.fields ? redactValue(entry.fields, extraPatterns) : {};

  return {
    ...entry,
    message: redact(entry.message || ''),
    raw: redact(entry.raw || ''),
    exception,
    fields
  };
};

module.exports = {
  REDACTED,
  sanitizeText,
  redactString,
  redactValue,
  redactEntry,
  BUILTIN_PATTERNS
};
