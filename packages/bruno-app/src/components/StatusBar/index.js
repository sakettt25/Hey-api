import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import find from 'lodash/find';
import {
  IconSettings,
  IconCookie,
  IconSearch,
  IconPalette,
  IconBrandGithub,
  IconFolder,
  IconBox,
  IconGitBranch,
  IconTerminal2
} from '@tabler/icons';
import Mousetrap from 'mousetrap';
import { getKeyBindingsForActionAllOS } from 'providers/Hotkeys/keyMappings';
import ToolHint from 'components/ToolHint';
import Cookies from 'components/Cookies';
import Notifications from 'components/Notifications';
import Portal from 'components/Portal';
import ThemeDropdown from './ThemeDropdown';
import Bruno from 'components/Bruno';
import { openConsole } from 'providers/ReduxStore/slices/logs';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { useApp } from 'providers/App';
import { getPlatformModifierKey } from 'utils/common/platform';
import StyledWrapper from './StyledWrapper';

const StatusBar = () => {
  const dispatch = useDispatch();
  const activeWorkspaceUid = useSelector((state) => state.workspaces.activeWorkspaceUid);
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeTab = find(tabs, (t) => t.uid === activeTabUid);
  const logs = useSelector((state) => state.logs.logs);
  const { globalEnvironments } = useSelector((state) => state.globalEnvironments || {});
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const { version } = useApp();
  const modKey = getPlatformModifierKey();

  const activeWorkspace = workspaces?.find((w) => w.uid === activeWorkspaceUid) || workspaces?.[0];
  const workspaceCollectionsCount = activeWorkspace?.collections?.length || 0;
  const workspaceEnvironmentsCount = globalEnvironments?.length || 0;

  const errorCount = logs.filter((log) => log.type === 'error').length;

  const handleConsoleClick = () => {
    dispatch(openConsole());
  };

  const handlePreferencesClick = () => {
    const collectionUid = activeTab?.collectionUid || activeWorkspace?.scratchCollectionUid;

    dispatch(
      addTab({
        type: 'preferences',
        uid: collectionUid ? `${collectionUid}-preferences` : 'preferences',
        collectionUid: collectionUid
      })
    );
  };

  const openGlobalSearch = () => {
    const bindings = getKeyBindingsForActionAllOS('globalSearch') || [];
    bindings.forEach((binding) => {
      Mousetrap.trigger(binding);
    });
  };

  return (
    <StyledWrapper>
      {cookiesOpen && (
        <Portal>
          <Cookies
            onClose={() => {
              setCookiesOpen(false);
              document.querySelector('[data-trigger="cookies"]')?.focus();
            }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="cookies-title"
            aria-describedby="cookies-description"
          />
        </Portal>
      )}

      <div className="status-bar">
        {/* ── Left: Contextual chips (Workspace, Stats, Branch) ── */}
        <div className="status-bar-section status-bar-left">
          <div className="status-bar-chips">
            {/* Active Workspace chip */}
            <div
              className="footer-chip workspace-chip"
              title={`Active Workspace: ${activeWorkspace?.name || 'Workspace'}`}
            >
              <IconFolder size={12} strokeWidth={1.8} className="chip-icon workspace-icon" />
              <span className="chip-label">{activeWorkspace?.name || 'Workspace'}</span>
            </div>

            {/* Collection and Environment count chip */}
            <div
              className="footer-chip stats-chip"
              title={`${workspaceCollectionsCount} collections, ${workspaceEnvironmentsCount} environments in this workspace`}
            >
              <IconBox size={12} strokeWidth={1.8} className="chip-icon stats-icon" />
              <span className="chip-value">{workspaceCollectionsCount}</span>
              <span className="chip-unit">{workspaceCollectionsCount === 1 ? 'col' : 'cols'}</span>
              <span className="chip-dot">·</span>
              <span className="chip-value">{workspaceEnvironmentsCount}</span>
              <span className="chip-unit">{workspaceEnvironmentsCount === 1 ? 'env' : 'envs'}</span>
            </div>

            {/* Git Branch chip */}
            <div className="footer-chip git-chip" title="Git Branch: main">
              <IconGitBranch size={12} strokeWidth={1.8} className="chip-icon git-icon" />
              <span className="chip-label">main</span>
            </div>
          </div>
        </div>

        {/* ── Center: Command Palette / Search dock ── */}
        <div className="status-bar-section status-bar-center">
          <button
            className="footer-search-pill"
            onClick={openGlobalSearch}
            tabIndex={0}
            aria-label="Global Search"
            title={`Quick search requests and commands (${modKey} P)`}
          >
            <IconSearch size={12} strokeWidth={1.8} className="search-icon" />
            <span className="search-placeholder">Quick search & commands</span>
            <kbd className="search-kbd">{modKey} P</kbd>
          </button>
        </div>

        {/* ── Right: Tools, System Controls & Brand Capsule ── */}
        <div className="status-bar-section status-bar-right">
          {/* Tools: Dev Tools & Cookies */}
          <div className="status-tool-group">
            <button
              className={`footer-tool-btn ${errorCount > 0 ? 'has-errors' : ''}`}
              data-trigger="dev-tools"
              onClick={handleConsoleClick}
              tabIndex={0}
              aria-label={`Open Dev Tools${errorCount > 0 ? ` (${errorCount} errors)` : ''}`}
              title="Developer Tools & Console Logs"
            >
              <IconTerminal2 size={13} strokeWidth={1.8} className="tool-icon" />
              <span className="tool-label">Dev Tools</span>
              {errorCount > 0 ? (
                <span className="error-badge">{errorCount}</span>
              ) : (
                <span className="healthy-dot" title="No errors logged" />
              )}
            </button>

            <button
              className="footer-tool-btn"
              data-trigger="cookies"
              onClick={() => setCookiesOpen(true)}
              tabIndex={0}
              aria-label="Open Cookies"
              title="Manage Cookies"
            >
              <IconCookie size={13} strokeWidth={1.8} className="tool-icon" />
              <span className="tool-label">Cookies</span>
            </button>
          </div>

          <div className="status-bar-divider" />

          {/* Quick System Icons Cluster */}
          <div className="status-icon-cluster">
            <ToolHint text="Preferences" toolhintId="Preferences" place="top" offset={10}>
              <button
                className="footer-icon-btn"
                data-trigger="preferences"
                onClick={handlePreferencesClick}
                tabIndex={0}
                aria-label="Open Preferences"
              >
                <IconSettings size={13} strokeWidth={1.6} />
              </button>
            </ToolHint>

            <ThemeDropdown>
              <button
                className="footer-icon-btn"
                data-trigger="theme"
                tabIndex={0}
                aria-label="Change Theme"
              >
                <IconPalette size={13} strokeWidth={1.6} />
              </button>
            </ThemeDropdown>

            <ToolHint text="Notifications" toolhintId="Notifications" place="top" offset={10}>
              <div className="footer-icon-btn notifications-wrapper">
                <Notifications />
              </div>
            </ToolHint>

            <ToolHint text="GitHub Repository" toolhintId="GitHub" place="top" offset={10}>
              <button
                className="footer-icon-btn"
                onClick={() => {
                  window?.ipcRenderer?.openExternal('https://github.com/usebruno/bruno');
                }}
                tabIndex={0}
                aria-label="Open GitHub Repository"
              >
                <IconBrandGithub size={13} strokeWidth={1.6} />
              </button>
            </ToolHint>
          </div>

          <div className="status-bar-divider" />

          {/* Branding & Attribution */}
          <div className="status-brand-group">
            <span className="footer-author">© Saket Saurav</span>
            <div className="footer-brand-capsule" title={`Hey API v${version} · By Saket Saurav`}>
              <Bruno width={13} />
              <span className="brand-name">Hey API</span>
              <span className="brand-badge">v{version}</span>
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default StatusBar;
