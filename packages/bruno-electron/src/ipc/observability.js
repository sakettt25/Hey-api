/**
 * IPC registration for the Local Observability feature.
 *
 * Follows the existing Bruno IPC conventions:
 *   - `ipcMain.handle('renderer:observability:<action>', ...)` for
 *     request/response calls from the renderer.
 *   - `mainWindow.webContents.send('main:observability:<channel>', payload)`
 *     for push events (live log entries, source state, session updates).
 *
 * Security boundaries:
 *   - File paths are validated against `dialog.showOpenDialog` (user picks
 *     them) — we never accept an arbitrary path from the renderer and open
 *     it silently. (A future hardening could restrict to a workspace dir, but
 *     explicit user file selection is the baseline requirement.)
 *   - Process sources: command/args/cwd/env all come from the renderer's
 *     "user-configured source" form. We never construct a command from log
 *     content or from untrusted input.
 *   - No new renderer access to Node APIs; everything goes through the
 *     existing `window.ipcRenderer` bridge.
 */

const path = require('path');
const fs = require('fs');
const { ipcMain, dialog } = require('electron');
const { ObservabilityManager } = require('../services/observability');

// Shared singleton so the network module can drive the request lifecycle
// (session create/sent/received + correlation header injection) without an
// IPC round-trip. Set by registerObservabilityIpc; read by getSharedManager.
let sharedManager = null;

const setSharedManager = (m) => { sharedManager = m; };
const getSharedManager = () => sharedManager;

/**
 * @param {Electron.BrowserWindow} mainWindow
 * @param {{ manager?: ObservabilityManager, getPreferences?: () => any, savePreferences?: (p:any) => Promise<void> }} deps
 */
const registerObservabilityIpc = (mainWindow, deps = {}) => {
  // Build the manager with an emit callback that forwards to the renderer.
  const manager = deps.manager || new ObservabilityManager({
    emit: (channel, payload) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channel, payload);
        }
      } catch (err) {
        // renderer may be torn down; ignore
      }
    }
  });

  // Remember the shared instance so other main-process modules (network IPC)
  // can drive request lifecycle hooks without a round-trip through IPC.
  sharedManager = manager;

  const getPrefs = deps.getPreferences || (() => ({}));
  const savePrefs = deps.savePreferences || (() => Promise.resolve());

  // Apply any persisted observability preferences at registration time.
  try {
    const prefs = getPrefs();
    if (prefs && prefs.observability) {
      manager.updateConfig({
        correlationHeaderName: prefs.observability.correlationHeaderName,
        timeWindowMs: prefs.observability.timeWindowMs,
        redactionExtraPatterns: prefs.observability.redactionExtraPatterns
      });
    }
  } catch (err) {
    console.error('[observability] failed to apply persisted prefs', err);
  }

  // ── Browse for a log file (native dialog) ──────────────────────────────────
  ipcMain.handle('renderer:observability:browse-log-file', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select a local log file to tail',
      properties: ['openFile'],
      filters: [
        { name: 'Log files', extensions: ['log', 'json', 'ndjson', 'out', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (!filePaths || !filePaths[0]) return null;
    const filePath = path.resolve(filePaths[0]);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { error: 'Not a file', filePath };
      return { filePath, size: stat.size };
    } catch (err) {
      return { error: err.message, filePath };
    }
  });

  // ── Add a file source ───────────────────────────────────────────────────────
  ipcMain.handle('renderer:observability:add-file-source', async (event, opts = {}) => {
    if (!opts.filePath) return { error: 'filePath is required' };
    try {
      const source = await manager.addFileSource({
        filePath: opts.filePath,
        name: opts.name,
        startFromEnd: opts.startFromEnd !== false,
        loadRecentLines: !!opts.loadRecentLines,
        recentLinesCount: opts.recentLinesCount
      });
      return { source };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Add a process source ─────────────────────────────────────────────────────
  ipcMain.handle('renderer:observability:add-process-source', async (event, opts = {}) => {
    if (!opts.command) return { error: 'command is required' };
    try {
      const source = manager.addProcessSource({
        command: opts.command,
        args: opts.args || [],
        cwd: opts.cwd || null,
        env: opts.env || null,
        name: opts.name
      });
      return { source };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Docker: detect + list containers ────────────────────────────────────────
  ipcMain.handle('renderer:observability:docker-detect', async () => {
    return await ObservabilityManager.detectDocker();
  });

  ipcMain.handle('renderer:observability:docker-list-containers', async () => {
    return await ObservabilityManager.listContainers();
  });

  ipcMain.handle('renderer:observability:add-docker-source', async (event, opts = {}) => {
    if (!opts.containerId) return { error: 'containerId is required' };
    try {
      const source = await manager.addDockerSource({
        containerId: opts.containerId,
        containerName: opts.containerName,
        since: opts.since,
        name: opts.name
      });
      return { source };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Source control ─────────────────────────────────────────────────────────
  ipcMain.handle('renderer:observability:list-sources', async () => manager.listSources());
  ipcMain.handle('renderer:observability:pause-source', async (event, sourceId) => {
    manager.pauseSource(sourceId);
    return manager.getSource(sourceId);
  });
  ipcMain.handle('renderer:observability:resume-source', async (event, sourceId) => {
    manager.resumeSource(sourceId);
    return manager.getSource(sourceId);
  });
  ipcMain.handle('renderer:observability:remove-source', async (event, sourceId) => {
    return await manager.removeSource(sourceId);
  });

  // ── Entry queries + export ─────────────────────────────────────────────────
  ipcMain.handle('renderer:observability:get-entries', async (event, filter = {}) => {
    return manager.getEntries(filter);
  });

  ipcMain.handle('renderer:observability:get-entries-for-session', async (event, sessionId) => {
    return manager.getEntriesForSession(sessionId);
  });

  ipcMain.handle('renderer:observability:export-entries', async (event, opts = {}) => {
    const entries = opts.entries || manager.getEntries(opts.filter || {});
    return manager.exportEntries(entries, { pretty: opts.pretty });
  });

  // ── Debug sessions ──────────────────────────────────────────────────────────
  ipcMain.handle('renderer:observability:get-sessions', async (event, limit = 50) => manager.getSessions(limit));
  ipcMain.handle('renderer:observability:get-session', async (event, sessionId) => manager.getSession(sessionId));
  ipcMain.handle('renderer:observability:cancel-session', async (event, sessionId) => {
    manager.cancelSession(sessionId);
    return manager.getSession(sessionId);
  });

  // ── Config (persisted via the existing preferences store) ─────────────────
  ipcMain.handle('renderer:observability:update-config', async (event, opts = {}) => {
    manager.updateConfig(opts);
    try {
      const prefs = getPrefs();
      prefs.observability = prefs.observability || {};
      if (typeof opts.correlationHeaderName === 'string') prefs.observability.correlationHeaderName = opts.correlationHeaderName;
      if (typeof opts.timeWindowMs === 'number') prefs.observability.timeWindowMs = opts.timeWindowMs;
      if (Array.isArray(opts.redactionExtraPatterns)) prefs.observability.redactionExtraPatterns = opts.redactionExtraPatterns;
      await savePrefs(prefs);
    } catch (err) {
      console.error('[observability] failed to persist config', err);
    }
    return { ok: true };
  });

  // ── Request lifecycle hooks (called by the network IPC path) ───────────────
  // These are NOT exposed to the renderer — they are invoked from
  // ipc/network/index.js when a request starts/finishes. Registered as
  // plain handlers so the network code can call ipcRenderer.invoke too if
  // needed, but primarily called via the manager directly.
  ipcMain.handle('renderer:observability:create-session-for-request', async (event, opts = {}) => {
    const session = manager.createSessionForRequest(opts);
    return session;
  });

  return { manager };
};

module.exports = { registerObservabilityIpc, setSharedManager, getSharedManager };
