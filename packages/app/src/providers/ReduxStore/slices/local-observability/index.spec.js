import reducer, {
  addEntry,
  clearEntries,
  setSelectedEntry,
  setPaused,
  setSources,
  addSource,
  removeSource,
  updateSourceState,
  setSessions,
  updateSession,
  setFilter,
  toggleSeverityFilter,
  setAllSeverityFilters,
  resetFilters,
  selectFilteredEntries,
  SEVERITIES,
  MAX_ENTRIES
} from './index';

const makeEntry = (overrides) => ({
  id: 'log1',
  timestamp: 1000,
  severity: 'INFO',
  message: 'hello',
  raw: 'hello',
  source: { id: 'src1', type: 'file', name: 'app.log' },
  fields: {},
  exception: null,
  sessions: { exact: [], potential: [] },
  ...overrides
});

describe('localObservability slice — entry ingestion', () => {
  it('appends entries and updates stats', () => {
    let state = reducer(undefined, addEntry({ entry: makeEntry({ id: 'a', severity: 'INFO' }) }));
    state = reducer(state, addEntry({ entry: makeEntry({ id: 'b', severity: 'ERROR' }) }));
    expect(state.entries.length).toBe(2);
    expect(state.stats.total).toBe(2);
    expect(state.stats.bySeverity.INFO).toBe(1);
    expect(state.stats.bySeverity.ERROR).toBe(1);
  });

  it('updates an existing entry in place for continuations', () => {
    let state = reducer(undefined, addEntry({ entry: makeEntry({ id: 'a', message: 'oops' }) }));
    state = reducer(state, addEntry({ entry: makeEntry({ id: 'a', message: 'oops\n  at x' }), isContinuation: true }));
    expect(state.entries.length).toBe(1);
    expect(state.entries[0].message).toBe('oops\n  at x');
  });

  it('clears entries and stats', () => {
    let state = reducer(undefined, addEntry({ entry: makeEntry() }));
    state = reducer(state, clearEntries());
    expect(state.entries).toEqual([]);
    expect(state.stats.total).toBe(0);
    expect(state.selectedEntryId).toBeNull();
  });

  it('caps the entries ring at MAX_ENTRIES', () => {
    let state = undefined;
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      state = reducer(state, addEntry({ entry: makeEntry({ id: `e${i}` }) }));
    }
    expect(state.entries.length).toBe(MAX_ENTRIES);
  });
});

describe('localObservability slice — pause/resume', () => {
  it('buffers entries while paused and flushes on resume', () => {
    let state = reducer(undefined, setPaused(true));
    state = reducer(state, addEntry({ entry: makeEntry({ id: 'a' }) }));
    state = reducer(state, addEntry({ entry: makeEntry({ id: 'b' }) }));
    expect(state.entries).toEqual([]);
    expect(state.pendingBuffer.length).toBe(2);
    state = reducer(state, setPaused(false));
    expect(state.entries.length).toBe(2);
    expect(state.pendingBuffer).toEqual([]);
  });
});

describe('localObservability slice — sources', () => {
  it('adds, removes, and updates source state', () => {
    let state = reducer(undefined, setSources([{ sourceId: 's1', type: 'file', name: 'a.log' }]));
    expect(state.sources.length).toBe(1);
    state = reducer(state, addSource({ sourceId: 's2', type: 'process', name: 'node' }));
    expect(state.sources.length).toBe(2);
    state = reducer(state, updateSourceState({ sourceId: 's2', state: 'error', source: { sourceId: 's2', name: 'node' } }));
    expect(state.sourceState.s2).toBe('error');
    state = reducer(state, removeSource('s1'));
    expect(state.sources.find((s) => s.sourceId === 's1')).toBeUndefined();
  });
});

describe('localObservability slice — sessions', () => {
  it('updates an existing session and adds a new one', () => {
    let state = reducer(undefined, setSessions([{ id: 'sess1', status: 'running' }]));
    state = reducer(state, updateSession({ id: 'sess1', status: 'completed' }));
    expect(state.sessions[0].status).toBe('completed');
    state = reducer(state, updateSession({ id: 'sess2', status: 'running' }));
    expect(state.sessions.length).toBe(2);
  });
});

describe('localObservability slice — filters', () => {
  it('toggles individual severity filters', () => {
    let state = reducer(undefined, toggleSeverityFilter('INFO'));
    expect(state.filters.severities.INFO).toBe(false);
    state = reducer(state, toggleSeverityFilter('INFO'));
    expect(state.filters.severities.INFO).toBe(true);
  });

  it('sets all severity filters at once', () => {
    let state = reducer(undefined, setAllSeverityFilters(false));
    SEVERITIES.forEach((s) => expect(state.filters.severities[s]).toBe(false));
    state = reducer(state, setAllSeverityFilters(true));
    SEVERITIES.forEach((s) => expect(state.filters.severities[s]).toBe(true));
  });

  it('sets and resets text filter', () => {
    let state = reducer(undefined, setFilter({ key: 'text', value: 'needle' }));
    expect(state.filters.text).toBe('needle');
    state = reducer(state, resetFilters());
    expect(state.filters.text).toBe('');
  });
});

describe('selectFilteredEntries', () => {
  it('filters by severity, text, source, and session', () => {
    const state = {
      localObservability: {
        entries: [
          makeEntry({ id: '1', severity: 'INFO', message: 'apple', source: { id: 'src1', name: 'a' } }),
          makeEntry({ id: '2', severity: 'ERROR', message: 'banana', source: { id: 'src2', name: 'b' } }),
          makeEntry({ id: '3', severity: 'WARN', message: 'apple pie', source: { id: 'src1', name: 'a' } })
        ],
        filters: {
          severities: { TRACE: true, DEBUG: true, INFO: true, WARN: true, ERROR: true, FATAL: true },
          text: 'apple',
          sourceIds: null,
          services: null,
          requestId: '',
          traceId: '',
          spanId: '',
          sessionId: null,
          onlyErrorsAndWarnings: false,
          timeFrom: null,
          timeTo: null
        },
        sessions: []
      }
    };
    const r = selectFilteredEntries(state);
    expect(r.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('filters out a disabled severity', () => {
    const state = {
      localObservability: {
        entries: [makeEntry({ id: '1', severity: 'INFO' }), makeEntry({ id: '2', severity: 'ERROR' })],
        filters: {
          severities: { TRACE: true, DEBUG: true, INFO: false, WARN: true, ERROR: true, FATAL: true },
          text: '', sourceIds: null, services: null, requestId: '', traceId: '', spanId: '',
          sessionId: null, onlyErrorsAndWarnings: false, timeFrom: null, timeTo: null
        },
        sessions: []
      }
    };
    const r = selectFilteredEntries(state);
    expect(r.map((e) => e.id)).toEqual(['2']);
  });
});
