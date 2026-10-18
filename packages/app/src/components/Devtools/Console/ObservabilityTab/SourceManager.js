import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconPlus, IconPlayerPause, IconPlayerPlay, IconX, IconFileUpload, IconTerminal2, IconBrandDocker, IconRefresh } from '@tabler/icons';
import toast from 'react-hot-toast';
import {
  browseLogFile,
  addFileSource,
  addProcessSource,
  dockerDetect,
  dockerListContainers,
  addDockerSource,
  pauseSource,
  resumeSource,
  removeSourceAndCleanup
} from 'providers/ReduxStore/slices/local-observability/actions';

const SourceChip = ({ source, state }) => {
  const dispatch = useDispatch();
  const paused = state === 'paused';
  const stoppable = source?.type === 'process' || source?.type === 'docker';

  return (
    <span className="obs-source-chip" title={source?.name}>
      <span className={`dot ${state || 'starting'}`} />
      <span className="chip-name">{source?.name || source?.sourceId}</span>
      <span className="chip-actions">
        <button
          title={paused ? 'Resume' : 'Pause'}
          onClick={() => dispatch(paused ? resumeSource(source.sourceId) : pauseSource(source.sourceId))}
        >
          {paused ? <IconPlayerPlay size={12} /> : <IconPlayerPause size={12} />}
        </button>
        <button
          title={stoppable ? 'Stop & remove' : 'Remove'}
          onClick={() => dispatch(removeSourceAndCleanup(source.sourceId))}
        >
          <IconX size={12} />
        </button>
      </span>
    </span>
  );
};

const AddSourceModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('file');
  const [filePath, setFilePath] = useState('');
  const [name, setName] = useState('');
  const [startFromEnd, setStartFromEnd] = useState(true);
  const [loadRecent, setLoadRecent] = useState(false);
  const [recentCount, setRecentCount] = useState(200);
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [cwd, setCwd] = useState('');
  const [env, setEnv] = useState('');
  const [containers, setContainers] = useState([]);
  const [containerId, setContainerId] = useState('');
  const [dockerStatus, setDockerStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const browse = async () => {
    const result = await dispatch(browseLogFile());
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    if (result?.filePath) {
      setFilePath(result.filePath);
      if (!name) setName(result.filePath.split(/[\\/]/).pop());
    }
  };

  const submitFile = async () => {
    if (!filePath) { toast.error('Select a log file first'); return; }
    setBusy(true);
    const r = await dispatch(addFileSource({ filePath, name, startFromEnd, loadRecentLines: loadRecent, recentLinesCount: Number(recentCount) || 200 }));
    setBusy(false);
    if (r?.error) { toast.error(r.error); return; }
    toast.success('Tailing log file');
    onClose();
  };

  const submitProcess = async () => {
    if (!command) { toast.error('Enter a command to run'); return; }
    setBusy(true);
    const r = await dispatch(addProcessSource({
      command,
      args: args ? args.split(/\s+/).filter(Boolean) : [],
      cwd: cwd || null,
      env: env ? parseEnv(env) : null,
      name: name || command
    }));
    setBusy(false);
    if (r?.error) { toast.error(r.error); return; }
    toast.success('Process started');
    onClose();
  };

  const refreshDocker = async () => {
    setBusy(true);
    const detect = await dispatch(dockerDetect());
    setDockerStatus(detect);
    if (detect?.available) {
      const list = await dispatch(dockerListContainers());
      setContainers(list?.containers || []);
    }
    setBusy(false);
  };

  const submitDocker = async () => {
    if (!containerId) { toast.error('Select a container'); return; }
    const c = containers.find((x) => x.id === containerId);
    setBusy(true);
    const r = await dispatch(addDockerSource({
      containerId,
      containerName: c?.name || containerId,
      since: '1m',
      name: name || `docker:${c?.name || containerId}`
    }));
    setBusy(false);
    if (r?.error) { toast.error(r.error); return; }
    toast.success('Streaming container logs');
    onClose();
  };

  return (
    <div className="obs-add-modal-backdrop" onClick={onClose}>
      <div className="obs-add-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add a local log source</h3>
        <div className="obs-sev">
          <button className={`obs-sev-btn ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}><IconFileUpload size={12} style={{ marginRight: 4 }} />File</button>
          <button className={`obs-sev-btn ${tab === 'process' ? 'active' : ''}`} onClick={() => setTab('process')}><IconTerminal2 size={12} style={{ marginRight: 4 }} />Process</button>
          <button className={`obs-sev-btn ${tab === 'docker' ? 'active' : ''}`} onClick={() => setTab('docker')}><IconBrandDocker size={12} style={{ marginRight: 4 }} />Docker</button>
        </div>

        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
        </label>

        {tab === 'file' && (
          <>
            <label>
              Log file <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="C:\\logs\\app.log or /var/log/app.log" />
            </label>
            <div className="row">
              <button className="obs-btn primary" onClick={browse} disabled={busy}>Browse…</button>
            </div>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={startFromEnd} onChange={(e) => setStartFromEnd(e.target.checked)} />
              Start at end of file (recommended)
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={loadRecent} onChange={(e) => setLoadRecent(e.target.checked)} />
              Load recent history on start
            </label>
            {loadRecent && (
              <label>Recent lines count <input type="number" value={recentCount} onChange={(e) => setRecentCount(e.target.value)} min={1} /></label>
            )}
            <div className="hint">The file is read-only. Hey API never modifies or deletes it.</div>
            <div className="actions">
              <button className="obs-btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="obs-btn primary" onClick={submitFile} disabled={busy}>Tail file</button>
            </div>
          </>
        )}

        {tab === 'process' && (
          <>
            <label>Command <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="node server.js" /></label>
            <label>Args (space-separated) <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="--port 8080" /></label>
            <label>Working directory <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="optional" /></label>
            <label>Environment (KEY=value, one per line) <textarea value={env} onChange={(e) => setEnv(e.target.value)} rows={3} placeholder="NODE_ENV=development" /></label>
            <div className="hint">The command runs only when you click Start. stdout/stderr are kept separate. You can stop it any time.</div>
            <div className="actions">
              <button className="obs-btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="obs-btn primary" onClick={submitProcess} disabled={busy}>Start</button>
            </div>
          </>
        )}

        {tab === 'docker' && (
          <>
            <button className="obs-btn primary" onClick={refreshDocker} disabled={busy}><IconRefresh size={12} style={{ marginRight: 4 }} />Detect Docker</button>
            {dockerStatus && !dockerStatus.available && (
              <div className="hint">Docker is not available: {dockerStatus.error}</div>
            )}
            {dockerStatus?.available && (
              <>
                <label>
                  Container
                  <select className="obs-session-select" value={containerId} onChange={(e) => setContainerId(e.target.value)} style={{ maxWidth: '100%' }}>
                    <option value="">Select a container…</option>
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.image}) — {c.status}</option>
                    ))}
                  </select>
                </label>
                <div className="hint">Reads logs only. Never starts/stops/destroys containers.</div>
              </>
            )}
            <div className="actions">
              <button className="obs-btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="obs-btn primary" onClick={submitDocker} disabled={busy || !containerId}>Stream logs</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const parseEnv = (text) => {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
};

const SourceManager = () => {
  const dispatch = useDispatch();
  const sources = useSelector((s) => s.localObservability.sources);
  const sourceState = useSelector((s) => s.localObservability.sourceState);
  const [adding, setAdding] = useState(false);

  return (
    <div className="obs-source-strip">
      <button className="obs-btn primary" onClick={() => setAdding(true)}>
        <IconPlus size={13} /> Add source
      </button>
      {sources.map((src) => (
        <SourceChip key={src.sourceId} source={src} state={sourceState[src.sourceId]} />
      ))}
      {sources.length === 0 && <span className="hint" style={{ color: 'var(--obs-hint, #888)', fontSize: 11 }}>No log sources configured.</span>}
      {adding && <AddSourceModal onClose={() => setAdding(false)} />}
    </div>
  );
};

export default SourceManager;
