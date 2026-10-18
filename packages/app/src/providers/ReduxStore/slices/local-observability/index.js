import { createSlice } from '@reduxjs/toolkit';

/**
 * Redux slice for the Local Observability feature (the live log debugger).
 *
 * State shape:
 *   sources         : configured log sources (file/process/docker)
 *   entries         : bounded ring of normalized, redacted log entries pushed
 *                     from the main process via `main:observability:log-entry`
 *   pendingBuffer  : entries that arrived while `paused` was true. Flushed to
 *                     `entries` on resume so the user can inspect earlier logs
 *                     without the view jumping (the task's "pause auto-scroll
 *                     while inspecting earlier entries" requirement).
 *   selectedEntryId: the log row currently expanded in the details pane
 *   paused         : whether the live stream is paused (UI control)
 *   filters        : severity toggles + text + source/service/requestId/traceId
 *                     + sessionId + time range
 *   sessions       : recent debug sessions (request ↔ log correlation)
 *   sourceState    : per-source runtime state (following/missing/error/...)
 *   config         : correlation header name, time window, redaction patterns
 *   stats          : running counts (total + per severity)
 *
 * The reducer is pure and unit-testable. IPC thunks live in actions.js.
 */

export const SEVERITIES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

export const MAX_ENTRIES = 5000;
export const MAX_PENDING = 5000;

const initialFilters = {
  severities: { TRACE: true, DEBUG: true, INFO: true, WARN: true, ERROR: true, FATAL: true },
  text: '',
  sourceIds: null, // null = all; string[] = whitelist
  services: null,
  requestId: '',
  traceId: '',
  spanId: '',
  sessionId: null, // filter to a specific debug session
  onlyErrorsAndWarnings: false,
  timeFrom: null, // ms
  timeTo: null // ms
};

const initialState = {
  sources: [],
  entries: [],
  pendingBuffer: [],
  selectedEntryId: null,
  paused: false,
  filters: initialFilters,
  sessions: [],
  sourceState: {}, // sourceId → state string
  config: {
    correlationHeaderName: 'X-Request-ID',
    timeWindowMs: 2000,
    redactionExtraPatterns: []
  },
  stats: {
    total: 0,
    bySeverity: {}
  }
};

const bumpStats = (stats, entry) => {
  stats.total += 1;
  if (entry.severity) {
    stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
  }
};

export const localObservabilitySlice = createSlice({
  name: 'localObservability',
  initialState,
  reducers: {
    // ── entry ingestion ───────────────────────────────────────────────────────
    addEntry: (state, action) => {
      const { entry, isContinuation } = action.payload || {};
      if (!entry) return;

      if (isContinuation && state.selectedEntryId !== entry.id) {
        // Update an existing row in place (multiline stack trace growth).
        const idx = state.entries.findIndex((e) => e.id === entry.id);
        if (idx !== -1) state.entries[idx] = entry;
        else if (state.paused) {
          const pidx = state.pendingBuffer.findIndex((e) => e.id === entry.id);
          if (pidx !== -1) state.pendingBuffer[pidx] = entry;
          else { state.pendingBuffer.push(entry); bumpStats(state.stats, entry); }
        }
        return;
      }

      bumpStats(state.stats, entry);
      if (state.paused) {
        state.pendingBuffer.push(entry);
        if (state.pendingBuffer.length > MAX_PENDING) {
          state.pendingBuffer.splice(0, state.pendingBuffer.length - MAX_PENDING);
        }
      } else {
        state.entries.push(entry);
        if (state.entries.length > MAX_ENTRIES) {
          state.entries.splice(0, state.entries.length - MAX_ENTRIES);
        }
      }
    },

    clearEntries: (state) => {
      state.entries = [];
      state.pendingBuffer = [];
      state.selectedEntryId = null;
      state.stats = { total: 0, bySeverity: {} };
    },

    setSelectedEntry: (state, action) => {
      state.selectedEntryId = action.payload;
    },

    // ── pause / resume ─────────────────────────────────────────────────────────
    setPaused: (state, action) => {
      const paused = !!action.payload;
      if (state.paused && !paused) {
        // Resuming: flush the pending buffer into the visible ring.
        const flushed = state.pendingBuffer.splice(0, state.pendingBuffer.length);
        state.entries.push(...flushed);
        if (state.entries.length > MAX_ENTRIES) {
          state.entries.splice(0, state.entries.length - MAX_ENTRIES);
        }
      }
      state.paused = paused;
    },

    // ── sources ───────────────────────────────────────────────────────────────
    setSources: (state, action) => {
      state.sources = action.payload || [];
    },
    addSource: (state, action) => {
      const src = action.payload;
      if (!src) return;
      const idx = state.sources.findIndex((s) => s.sourceId === src.sourceId);
      if (idx !== -1) state.sources[idx] = src;
      else state.sources.push(src);
    },
    removeSource: (state, action) => {
      const sourceId = action.payload;
      state.sources = state.sources.filter((s) => s.sourceId !== sourceId);
      delete state.sourceState[sourceId];
    },
    updateSourceState: (state, action) => {
      const { sourceId, state: srcState, source } = action.payload || {};
      if (sourceId) state.sourceState[sourceId] = srcState;
      if (source) {
        const idx = state.sources.findIndex((s) => s.sourceId === source.sourceId);
        if (idx !== -1) state.sources[idx] = { ...state.sources[idx], ...source };
      }
    },
    removeSourceEvent: (state, action) => {
      const sourceId = action.payload;
      state.sources = state.sources.filter((s) => s.sourceId !== sourceId);
      delete state.sourceState[sourceId];
    },

    // ── sessions ──────────────────────────────────────────────────────────────
    setSessions: (state, action) => {
      state.sessions = action.payload || [];
    },
    updateSession: (state, action) => {
      const session = action.payload;
      if (!session) return;
      const idx = state.sessions.findIndex((s) => s.id === session.id);
      if (idx !== -1) state.sessions[idx] = session;
      else state.sessions.unshift(session);
    },

    // ── filters ────────────────────────────────────────────────────────────────
    setFilter: (state, action) => {
      const { key, value } = action.payload;
      state.filters[key] = value;
    },
    toggleSeverityFilter: (state, action) => {
      const sev = action.payload;
      state.filters.severities[sev] = !state.filters.severities[sev];
    },
    setAllSeverityFilters: (state, action) => {
      const enabled = !!action.payload;
      SEVERITIES.forEach((s) => { state.filters.severities[s] = enabled; });
    },
    resetFilters: (state) => {
      state.filters = JSON.parse(JSON.stringify(initialFilters));
    },

    // ── config ────────────────────────────────────────────────────────────────
    setConfig: (state, action) => {
      state.config = { ...state.config, ...(action.payload || {}) };
    }
  }
});

export const {
  addEntry,
  clearEntries,
  setSelectedEntry,
  setPaused,
  setSources,
  addSource,
  removeSource,
  updateSourceState,
  removeSourceEvent,
  setSessions,
  updateSession,
  setFilter,
  toggleSeverityFilter,
  setAllSeverityFilters,
  resetFilters,
  setConfig
} = localObservabilitySlice.actions;

// ── Selectors ──────────────────────────────────────────────────────────────────
export const selectFilteredEntries = (state) => {
  const { entries, filters } = state.localObservability;
  const sev = filters.severities;
  const lowerText = filters.text ? filters.text.toLowerCase() : null;
  const src = filters.sourceIds ? new Set(filters.sourceIds) : null;
  const svc = filters.services ? new Set(filters.services) : null;

  let matchedIds = null;
  if (filters.sessionId) {
    const session = state.localObservability.sessions.find((s) => s.id === filters.sessionId);
    if (session) matchedIds = new Set([...session.matchedLogIds, ...session.potentialLogIds]);
  }

  return entries.filter((e) => {
    if (e.severity && !sev[e.severity]) return false;
    if (filters.onlyErrorsAndWarnings && e.severity !== 'ERROR' && e.severity !== 'WARN' && e.severity !== 'FATAL') return false;
    if (src && e.source?.id && !src.has(e.source.id)) return false;
    if (svc && e.service && !svc.has(e.service)) return false;
    if (filters.requestId && e.requestId !== filters.requestId && !(e.message || '').includes(filters.requestId)) return false;
    if (filters.traceId && e.traceId !== filters.traceId) return false;
    if (filters.spanId && e.spanId !== filters.spanId) return false;
    if (matchedIds && !matchedIds.has(e.id)) return false;
    if (typeof filters.timeFrom === 'number' && (e.timestamp || 0) < filters.timeFrom) return false;
    if (typeof filters.timeTo === 'number' && (e.timestamp || 0) > filters.timeTo) return false;
    if (lowerText) {
      const hay = `${e.message || ''} ${e.raw || ''} ${e.logger || ''} ${e.service || ''}`.toLowerCase();
      if (!hay.includes(lowerText)) return false;
    }
    return true;
  });
};

export default localObservabilitySlice.reducer;
