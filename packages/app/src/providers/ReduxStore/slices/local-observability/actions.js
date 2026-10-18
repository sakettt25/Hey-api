import {
  setSources,
  addSource,
  removeSource,
  updateSourceState,
  removeSourceEvent,
  setSessions,
  updateSession,
  setConfig,
  clearEntries,
  setSelectedEntry,
  setPaused as setPausedAction,
  setFilter
} from './index';

/**
 * Thunks for the Local Observability slice. Each one calls the main-process IPC
 * (channel prefix `renderer:observability:`) and dispatches the normalized
 * result. Push events (`main:observability:*`) are subscribed in the
 * ObservabilityTab component via `subscribeToObservabilityEvents`.
 */

const ipc = () => window?.ipcRenderer;

// ── Sources ────────────────────────────────────────────────────────────────────
export const browseLogFile = () => async () => {
  return ipc()?.invoke('renderer:observability:browse-log-file');
};

export const addFileSource = (opts) => async (dispatch) => {
  const result = await ipc()?.invoke('renderer:observability:add-file-source', opts);
  if (result?.source) dispatch(addSource(result.source));
  return result;
};

export const addProcessSource = (opts) => async (dispatch) => {
  const result = await ipc()?.invoke('renderer:observability:add-process-source', opts);
  if (result?.source) dispatch(addSource(result.source));
  return result;
};

export const dockerDetect = () => async () => {
  return ipc()?.invoke('renderer:observability:docker-detect');
};

export const dockerListContainers = () => async () => {
  return ipc()?.invoke('renderer:observability:docker-list-containers');
};

export const addDockerSource = (opts) => async (dispatch) => {
  const result = await ipc()?.invoke('renderer:observability:add-docker-source', opts);
  if (result?.source) dispatch(addSource(result.source));
  return result;
};

export const fetchSources = () => async (dispatch) => {
  const sources = await ipc()?.invoke('renderer:observability:list-sources');
  dispatch(setSources(sources || []));
  return sources;
};

export const pauseSource = (sourceId) => async (dispatch) => {
  const source = await ipc()?.invoke('renderer:observability:pause-source', sourceId);
  if (source) dispatch(updateSourceState({ sourceId, state: source.state, source }));
};

export const resumeSource = (sourceId) => async (dispatch) => {
  const source = await ipc()?.invoke('renderer:observability:resume-source', sourceId);
  if (source) dispatch(updateSourceState({ sourceId, state: source.state, source }));
};

export const removeSourceAndCleanup = (sourceId) => async (dispatch) => {
  await ipc()?.invoke('renderer:observability:remove-source', sourceId);
  dispatch(removeSource(sourceId));
};

// ── Entries / export ───────────────────────────────────────────────────────────
export const fetchEntries = (filter) => async () => {
  return ipc()?.invoke('renderer:observability:get-entries', filter || {});
};

export const fetchEntriesForSession = (sessionId) => async () => {
  return ipc()?.invoke('renderer:observability:get-entries-for-session', sessionId);
};

export const exportEntries = (opts) => async () => {
  return ipc()?.invoke('renderer:observability:export-entries', opts || {});
};

export const clearAllEntries = () => (dispatch) => dispatch(clearEntries());
export const selectEntry = (id) => (dispatch) => dispatch(setSelectedEntry(id));

// ── Pause / resume (UI-level) ─────────────────────────────────────────────────
export const setStreamPaused = (paused) => (dispatch) => dispatch(setPausedAction(paused));

// ── Filters ────────────────────────────────────────────────────────────────────
export const setEntryFilter = (key, value) => (dispatch) => dispatch(setFilter({ key, value }));

export {
  toggleSeverityFilter,
  setAllSeverityFilters,
  resetFilters
} from './index';

// ── Sessions ───────────────────────────────────────────────────────────────────
export const fetchSessions = () => async (dispatch) => {
  const sessions = await ipc()?.invoke('renderer:observability:get-sessions', 50);
  dispatch(setSessions(sessions || []));
};

export const cancelSession = (sessionId) => async (dispatch) => {
  const session = await ipc()?.invoke('renderer:observability:cancel-session', sessionId);
  if (session) dispatch(updateSession(session));
};

// ── Config ──────────────────────────────────────────────────────────────────────
export const updateConfig = (opts) => async (dispatch, getState) => {
  await ipc()?.invoke('renderer:observability:update-config', opts);
  dispatch(setConfig(opts));
  return getState().localObservability.config;
};

export const fetchConfig = () => async (dispatch) => {
  // Config is part of preferences; the main process applies it at startup.
  // We re-sync from the server via get-sessions (no dedicated getter); for
  // now, assume the local state is authoritative and just return it.
  return dispatch(setConfig({}));
};
