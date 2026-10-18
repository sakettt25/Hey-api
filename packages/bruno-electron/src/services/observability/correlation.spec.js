const { correlateLogToSessions } = require('./correlation');

const makeSession = (overrides) => ({
  id: 'dbg_session1',
  correlationId: 'dbg_session1',
  requestUid: 'req-1',
  traceId: null,
  startedAt: 1000,
  completedAt: 2000,
  status: 'running',
  timeWindowMs: 2000,
  ...overrides
});

describe('correlateLogToSessions — exact matches', () => {
  it('matches by requestId === correlationId', () => {
    const session = makeSession();
    const entry = { id: 'log1', requestId: 'dbg_session1', traceId: null, timestamp: 1500, message: '', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toContain('dbg_session1');
    expect(r.potential).not.toContain('dbg_session1');
  });

  it('matches by requestId === requestUid', () => {
    const session = makeSession();
    const entry = { id: 'log1', requestId: 'req-1', timestamp: 1500, message: '', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toContain('dbg_session1');
  });

  it('matches by traceId', () => {
    const session = makeSession({ traceId: 'trace-xyz' });
    const entry = { id: 'log1', traceId: 'trace-xyz', timestamp: 1500, message: '', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toContain('dbg_session1');
  });

  it('matches by correlation id substring in message (plain-text logs)', () => {
    const session = makeSession({ correlationId: 'dbg_abcdefghij' });
    const entry = { id: 'log1', requestId: null, traceId: null, timestamp: 1500, message: 'GET /users [reqId=dbg_abcdefghij]', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toContain('dbg_session1');
  });
});

describe('correlateLogToSessions — potential time-window matches', () => {
  it('labels a within-window log with no id as potential only', () => {
    const session = makeSession({ startedAt: 1000, completedAt: 2000, timeWindowMs: 500 });
    const entry = { id: 'log1', requestId: null, traceId: null, timestamp: 1300, message: 'something', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toEqual([]);
    expect(r.potential).toContain('dbg_session1');
  });

  it('does not match a log outside the time window when there is no id', () => {
    const session = makeSession({ startedAt: 1000, completedAt: 2000, timeWindowMs: 500 });
    const entry = { id: 'log1', timestamp: 3000, message: '', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toEqual([]);
    expect(r.potential).toEqual([]);
  });
});

describe('correlateLogToSessions — false-positive safeguards', () => {
  it('does not substring-match short ids (avoids collisions)', () => {
    const session = makeSession({ correlationId: 'ab' });
    const entry = { id: 'log1', timestamp: 1500, message: 'table absolute ab cd', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    // short id → only time-window potential, not exact substring
    expect(r.exact).toEqual([]);
  });

  it('does not claim a log belongs to a request merely because it arrived nearby', () => {
    const session = makeSession({ startedAt: 1000, completedAt: 2000, timeWindowMs: 0 });
    const entry = { id: 'log1', timestamp: 1500, message: 'unrelated', raw: '' };
    const r = correlateLogToSessions(entry, [session]);
    expect(r.exact).toEqual([]);
    expect(r.potential).toEqual([]);
  });

  it('returns empty when sessions list is empty', () => {
    const r = correlateLogToSessions({ id: 'x', timestamp: 1, message: '', raw: '' }, []);
    expect(r).toEqual({ exact: [], potential: [] });
  });
});
