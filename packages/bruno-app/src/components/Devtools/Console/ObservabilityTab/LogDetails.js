import React from 'react';
import { IconCopy, IconX } from '@tabler/icons';
import toast from 'react-hot-toast';

const copyText = (text, label) => {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Copy failed')
  );
};

const Meta = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </>
  );
};

const LogDetails = ({ entry, onClose }) => {
  if (!entry) {
    return (
      <div className="obs-details">
        <div className="obs-empty">Select a log entry to inspect its details.</div>
      </div>
    );
  }

  return (
    <div className="obs-details">
      <div className="details-header">
        <div className="details-title">Log details</div>
        <div className="details-actions">
          <button className="obs-icon-btn" title="Copy full message" onClick={() => copyText(entry.message, 'Message')}>
            <IconCopy size={14} />
          </button>
          {onClose && (
            <button className="obs-icon-btn" title="Close details" onClick={onClose}>
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="details-section">
        <h4>Summary</h4>
        <dl className="details-meta">
          <Meta label="Timestamp" value={entry.timestamp ? new Date(entry.timestamp).toISOString() : null} />
          <Meta label="Severity" value={entry.severity} />
          <Meta label="Service" value={entry.service} />
          <Meta label="Logger" value={entry.logger} />
          <Meta label="Source" value={entry.source?.name} />
          <Meta label="Source type" value={entry.source?.type} />
          <Meta label="Stream" value={entry.stream} />
          <Meta label="PID" value={entry.pid} />
          <Meta label="Request ID" value={entry.requestId} />
          <Meta label="Trace ID" value={entry.traceId} />
          <Meta label="Span ID" value={entry.spanId} />
        </dl>
      </div>

      {entry.message && (
        <div className="details-section">
          <h4>Message</h4>
          <pre className="details-pre">{entry.message}</pre>
        </div>
      )}

      {entry.exception && (entry.exception.stack || entry.exception.message || entry.exception.type) && (
        <div className="details-section">
          <h4>
            Exception
            <button className="obs-icon-btn" style={{ marginLeft: 8, verticalAlign: 'middle' }} title="Copy stack trace" onClick={() => copyText(entry.exception.stack || entry.exception.message || entry.exception.type, 'Stack trace')}>
              <IconCopy size={13} />
            </button>
          </h4>
          {entry.exception.type && <div style={{ marginBottom: 4 }}><strong>{entry.exception.type}</strong></div>}
          {entry.exception.message && <div style={{ marginBottom: 4 }}>{entry.exception.message}</div>}
          {entry.exception.stack && <pre className="details-pre details-stack">{entry.exception.stack}</pre>}
        </div>
      )}

      {entry.fields && Object.keys(entry.fields).length > 0 && (
        <div className="details-section">
          <h4>Structured fields</h4>
          <pre className="details-pre">{JSON.stringify(entry.fields, null, 2)}</pre>
        </div>
      )}

      <div className="details-section">
        <h4>
          Raw
          <button className="obs-icon-btn" style={{ marginLeft: 8, verticalAlign: 'middle' }} title="Copy raw line" onClick={() => copyText(entry.raw, 'Raw line')}>
            <IconCopy size={13} />
          </button>
        </h4>
        <pre className="details-pre">{entry.raw}</pre>
      </div>

      {entry.sessions && (entry.sessions.exact?.length || entry.sessions.potential?.length) ? (
        <div className="details-section">
          <h4>Correlation</h4>
          <div className="details-meta">
            <dt>Exact matches</dt>
            <dd>{entry.sessions.exact?.length || 0} session(s)</dd>
            <dt>Potential</dt>
            <dd>{entry.sessions.potential?.length || 0} session(s) (time window only)</dd>
          </div>
          <div className="hint" style={{ marginTop: 6, color: 'var(--obs-hint, #888)' }}>
            Potential matches arrived within the request time window but carry no matching request/trace id.
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LogDetails;
