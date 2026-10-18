/**
 * Local Observability service — main-process entry point.
 *
 * Re-exports the manager and the adapters so the IPC layer (and tests) can
 * import from a single location.
 */

const { ObservabilityManager } = require('./manager');
const { parseLogLine, createLogParser } = require('./parser');
const { redactEntry, redactString, sanitizeText } = require('./redactor');
const { FileTailSource } = require('./file-tailer');
const { ProcessSource } = require('./process-source');
const { DockerSource, detectDocker, listContainers } = require('./docker-source');
const { DebugSessionManager } = require('./debug-sessions');
const { correlateLogToSessions } = require('./correlation');

module.exports = {
  ObservabilityManager,
  parseLogLine,
  createLogParser,
  redactEntry,
  redactString,
  sanitizeText,
  FileTailSource,
  ProcessSource,
  DockerSource,
  detectDocker,
  listContainers,
  DebugSessionManager,
  correlateLogToSessions
};
