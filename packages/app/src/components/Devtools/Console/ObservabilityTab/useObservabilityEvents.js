import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  addEntry,
  updateSourceState,
  removeSourceEvent,
  updateSession,
  setSources
} from 'providers/ReduxStore/slices/local-observability';

/**
 * Subscribes to the Local Observability push channels from the main process
 * and dispatches the corresponding slice actions. Designed to be called once
 * from the ObservabilityTab component; returns nothing. All listeners are
 * cleaned up on unmount so re-mounting the tab re-subscribes cleanly.
 *
 * Channels (pushed from packages/electron/src/ipc/observability.js):
 *   main:observability:log-entry     { entry, isContinuation }
 *   main:observability:source-state { sourceId, state, source }
 *   main:observability:source-error  { sourceId, message, code }
 *   main:observability:source-exit   { sourceId, exitCode, signal }
 *   main:observability:source-removed{ sourceId }
 *   main:observability:session       { session }
 */
const useObservabilityEvents = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!window?.ipcRenderer) return () => {};

    const unsubLog = window.ipcRenderer.on('main:observability:log-entry', (payload) => {
      if (payload?.entry) {
        dispatch(addEntry({ entry: payload.entry, isContinuation: !!payload.isContinuation }));
      }
    });

    const unsubState = window.ipcRenderer.on('main:observability:source-state', (payload) => {
      if (payload?.sourceId) dispatch(updateSourceState(payload));
    });

    const unsubExit = window.ipcRenderer.on('main:observability:source-exit', (payload) => {
      if (payload?.sourceId) {
        dispatch(updateSourceState({ sourceId: payload.sourceId, state: 'exited', source: { exitCode: payload.exitCode, signal: payload.signal } }));
      }
    });

    const unsubError = window.ipcRenderer.on('main:observability:source-error', (payload) => {
      if (payload?.sourceId) {
        dispatch(updateSourceState({ sourceId: payload.sourceId, state: 'error', source: { error: payload.message } }));
      }
    });

    const unsubRemoved = window.ipcRenderer.on('main:observability:source-removed', (payload) => {
      if (payload?.sourceId) dispatch(removeSourceEvent(payload.sourceId));
    });

    const unsubSession = window.ipcRenderer.on('main:observability:session', (payload) => {
      if (payload?.session) dispatch(updateSession(payload.session));
    });

    // Sync the source list on mount (handles sources configured before the
    // tab was opened, e.g. restored from preferences).
    window.ipcRenderer
      .invoke('renderer:observability:list-sources')
      .then((sources) => dispatch(setSources(sources || [])))
      .catch(() => {});

    return () => {
      unsubLog?.();
      unsubState?.();
      unsubExit?.();
      unsubError?.();
      unsubRemoved?.();
      unsubSession?.();
    };
  }, [dispatch]);
};

export default useObservabilityEvents;
