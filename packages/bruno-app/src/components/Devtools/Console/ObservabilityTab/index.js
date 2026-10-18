import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconPlayerPause, IconPlayerPlay, IconTrash, IconDownload, IconBellOff, IconFilter } from '@tabler/icons';
import toast from 'react-hot-toast';

import useObservabilityEvents from './useObservabilityEvents';
import LogList from './LogList';
import LogDetails from './LogDetails';
import SourceManager from './SourceManager';
import StyledWrapper from './StyledWrapper';

import {
  selectFilteredEntries,
  SEVERITIES
} from 'providers/ReduxStore/slices/local-observability';
import {
  clearAllEntries,
  selectEntry,
  setStreamPaused,
  setEntryFilter,
  toggleSeverityFilter,
  setAllSeverityFilters,
  resetFilters,
  fetchSessions,
  cancelSession,
  exportEntries,
  fetchEntries
} from 'providers/ReduxStore/slices/local-observability/actions';

const SeverityToggle = ({ sev, counts, active, onClick }) => (
  <button
    className={`obs-sev-btn ${active ? 'active' : ''}`}
    onClick={onClick}
    title={`${sev} (${counts[sev] || 0})`}
  >
    {sev}
  </button>
);

const ObservabilityTab = () => {
  const dispatch = useDispatch();
  // Subscribe to main-process push events for the lifetime of this tab.
  useObservabilityEvents();

  const entries = useSelector(selectFilteredEntries);
  const allEntriesCount = useSelector((s) => s.localObservability.entries.length);
  const selectedEntryId = useSelector((s) => s.localObservability.selectedEntryId);
  const paused = useSelector((s) => s.localObservability.paused);
  const filters = useSelector((s) => s.localObservability.filters);
  const sessions = useSelector((s) => s.localObservability.sessions);
  const stats = useSelector((s) => s.localObservability.stats);

  const [showDetails, setShowDetails] = useState(true);

  // Pull recent entries + sessions on mount (so the tab is populated even if
  // it was reopened after logs had arrived).
  useEffect(() => {
    dispatch(fetchSessions());
    dispatch(fetchEntries({}));
  }, [dispatch]);

  const selectedEntry = useMemo(
    () => useSelector.length
      ? entries.find((e) => e.id === selectedEntryId) || null
      : null,
    [entries, selectedEntryId]
  );

  const handleSelect = useCallback(
    (id) => {
      dispatch(selectEntry(id));
      setShowDetails(true);
    },
    [dispatch]
  );

  const handlePause = useCallback(() => {
    dispatch(setStreamPaused(!paused));
    toast(paused ? 'Streaming resumed' : 'Stream paused — inspect freely', { icon: paused ? '▶️' : '⏸️' });
  }, [dispatch, paused]);

  const handleClear = useCallback(() => {
    dispatch(clearAllEntries());
  }, [dispatch]);

  const handleExport = useCallback(async () => {
    const json = await dispatch(exportEntries({ pretty: true }));
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hey-api-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported redacted logs');
  }, [dispatch]);

  const handleText = (e) => dispatch(setEntryFilter('text', e.target.value));
  const handleRequestId = (e) => dispatch(setEntryFilter('requestId', e.target.value));
  const handleTraceId = (e) => dispatch(setEntryFilter('traceId', e.target.value));
  const handleSession = (e) => dispatch(setEntryFilter('sessionId', e.target.value || null));

  return (
    <StyledWrapper>
      <div className="obs-toolbar">
        <div className="obs-sev">
          {SEVERITIES.map((sev) => (
            <SeverityToggle
              key={sev}
              sev={sev}
              counts={stats.bySeverity}
              active={filters.severities[sev]}
              onClick={() => dispatch(toggleSeverityFilter(sev))}
            />
          ))}
          <button className="obs-sev-btn" title="All severities" onClick={() => dispatch(setAllSeverityFilters(true))}>All</button>
          <button className="obs-sev-btn" title="None" onClick={() => dispatch(setAllSeverityFilters(false))}>None</button>
        </div>

        <div className="obs-search">
          <IconFilter size={13} style={{ color: 'var(--obs-hint, #888)' }} />
          <input value={filters.text} onChange={handleText} placeholder="Filter by text…" data-testid="obs-text-filter" />
        </div>

        <input
          className="obs-search"
          style={{ flex: '0 1 140px' }}
          value={filters.requestId}
          onChange={handleRequestId}
          placeholder="Request ID"
          title="Filter by request id (also searches message text)"
        />
        <input
          className="obs-search"
          style={{ flex: '0 1 140px' }}
          value={filters.traceId}
          onChange={handleTraceId}
          placeholder="Trace ID"
        />

        <select className="obs-session-select" value={filters.sessionId || ''} onChange={handleSession} title="Filter to a debug session">
          <option value="">All logs</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.method || '?'} {shortUrl(s.url)} · {s.status} · {s.matchedLogIds.length + s.potentialLogIds.length} logs
            </option>
          ))}
        </select>

        <button className="obs-icon-btn" title="Reset filters" onClick={() => dispatch(resetFilters())}>
          <IconBellOff size={14} />
        </button>

        <div style={{ flex: 1 }} />

        <button className="obs-icon-btn" title={paused ? 'Resume stream' : 'Pause stream'} onClick={handlePause}>
          {paused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
        </button>
        <button className="obs-icon-btn" title="Clear visible console" onClick={handleClear}>
          <IconTrash size={14} />
        </button>
        <button className="obs-icon-btn" title="Export redacted logs (JSON)" onClick={handleExport}>
          <IconDownload size={14} />
        </button>
      </div>

      <SourceManager />

      <div className="obs-body">
        <div className="obs-list-wrap">
          <LogList
            entries={entries}
            selectedEntryId={selectedEntryId}
            onSelect={handleSelect}
            paused={paused}
            onPauseStream={() => dispatch(setStreamPaused(true))}
            onResumeStream={() => dispatch(setStreamPaused(false))}
          />
          <div className="obs-source-strip" style={{ borderTop: '1px solid var(--obs-border, #333)' }}>
            <span className="hint" style={{ color: 'var(--obs-hint, #888)', fontSize: 11 }}>
              {entries.length} shown · {allEntriesCount} total · {paused ? 'paused' : 'live'}
            </span>
          </div>
        </div>

        {showDetails && (
          <LogDetails entry={selectedEntry} onClose={() => { setShowDetails(false); dispatch(selectEntry(null)); }} />
        )}
      </div>
    </StyledWrapper>
  );
};

const shortUrl = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`.slice(0, 40);
  } catch {
    return String(url).slice(0, 40);
  }
};

export default ObservabilityTab;
