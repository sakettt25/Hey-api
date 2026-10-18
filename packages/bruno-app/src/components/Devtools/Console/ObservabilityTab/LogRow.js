import React, { memo } from 'react';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconBug, IconClock, IconChevronRight } from '@tabler/icons';

const formatTime = (ms) => {
  if (typeof ms !== 'number') return '';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

const SeverityIcon = ({ sev }) => {
  const map = {
    ERROR: <IconAlertCircle size={13} color="hsl(8, 70%, 60%)" />,
    FATAL: <IconAlertCircle size={13} color="hsl(8, 70%, 60%)" />,
    WARN: <IconAlertTriangle size={13} color="hsl(41, 93%, 65%)" />,
    INFO: <IconInfoCircle size={13} color="hsl(190, 82%, 72%)" />,
    DEBUG: <IconBug size={13} color="hsl(260, 75%, 78%)" />,
    TRACE: <IconClock size={13} color="hsl(0, 0%, 60%)" />
  };
  return map[sev] || null;
};

const LogRow = memo(({ entry, isSelected, onClick }) => {
  const sev = entry?.severity || null;
  const matched = entry?.sessions?.exact?.length > 0;
  const potential = entry?.sessions?.potential?.length > 0;

  return (
    <div
      className={`obs-row ${isSelected ? 'selected' : ''}`}
      data-sev={sev || ''}
      onClick={onClick}
      data-testid="obs-log-row"
    >
      <span className="row-ts">{formatTime(entry.timestamp)}</span>
      <SeverityIcon sev={sev} />
      <span className="row-sev">{sev || ''}</span>
      <span className="row-src" title={entry?.source?.name || ''}>{entry?.source?.name || ''}</span>
      <span className="row-msg">
        {entry?.message || ''}
        {matched && <span style={{ color: 'hsl(140, 72%, 65%)', marginLeft: 6 }} title="Matches the active debug session by request/trace id">●</span>}
        {!matched && potential && <span style={{ color: 'hsl(41, 93%, 65%)', marginLeft: 6 }} title="Potential match — arrived in the request time window but has no matching id">◐</span>}
      </span>
    </div>
  );
});

export default LogRow;
