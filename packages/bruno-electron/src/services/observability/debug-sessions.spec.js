const { DebugSessionManager, MAX_SESSIONS } = require('./debug-sessions');

describe('DebugSessionManager — lifecycle', () => {
  it('createSession returns a running session with defaults', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({ itemUid: 'i1', collectionUid: 'c1', method: 'GET', url: 'http://x/y' });
    expect(s.status).toBe('running');
    expect(s.correlationId).toBeTruthy();
    expect(s.correlationHeaderName).toBe('X-Request-ID');
    expect(s.method).toBe('GET');
    expect(s.matchedLogIds).toEqual([]);
  });

  it('requestSent records the timestamp', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({});
    mgr.requestSent(s.id, { timestamp: 123 });
    expect(mgr.getSession(s.id).requestSentAt).toBe(123);
  });

  it('responseReceived records status, duration, completedAt', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({});
    mgr.responseReceived(s.id, { status: 200, duration: 42, completedAt: 999 });
    const got = mgr.getSession(s.id);
    expect(got.status).toBe('completed');
    expect(got.responseStatus).toBe(200);
    expect(got.duration).toBe(42);
    expect(got.completedAt).toBe(999);
  });

  it('cancelSession moves a running session to cancelled', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({});
    mgr.cancelSession(s.id);
    expect(mgr.getSession(s.id).status).toBe('cancelled');
  });
});

describe('DebugSessionManager — request-session creation', () => {
  it('records matching logs against the session', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({ correlationId: 'dbg_match1' });
    // A log carrying the correlation id should be recorded against the session.
    mgr.matchLogToSessions({ id: 'log1', requestId: 'dbg_match1', timestamp: 1, message: '', raw: '' });
    const got = mgr.getSession(s.id);
    expect(got.matchedLogIds).toContain('log1');
  });

  it('records potential matches separately from exact', () => {
    const mgr = new DebugSessionManager();
    const s = mgr.createSession({ startedAt: 1000, timeWindowMs: 1000, completedAt: 1000 });
    // Advance time slightly so the log is in the window.
    mgr.matchLogToSessions({ id: 'log2', timestamp: 1200, message: 'plain', raw: '' });
    const got = mgr.getSession(s.id);
    expect(got.potentialLogIds).toContain('log2');
    expect(got.matchedLogIds).not.toContain('log2');
  });
});

describe('DebugSessionManager — eviction', () => {
  it('evicts the oldest sessions when the ring is full', () => {
    const mgr = new DebugSessionManager();
    for (let i = 0; i < MAX_SESSIONS + 5; i++) {
      mgr.createSession({ itemUid: `i${i}` });
    }
    expect(mgr.getRecentSessions(MAX_SESSIONS + 5).length).toBe(MAX_SESSIONS);
  });
});
