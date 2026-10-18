const { parseLogLine, createLogParser, normalizeSeverity, parseTraceparent } = require('./parser');

describe('normalizeSeverity', () => {
  it('maps canonical levels', () => {
    expect(normalizeSeverity('INFO')).toBe('INFO');
    expect(normalizeSeverity('warn')).toBe('WARN');
    expect(normalizeSeverity('ERROR')).toBe('ERROR');
  });
  it('maps WARNING → WARN and SEVERE/CRITICAL → ERROR', () => {
    expect(normalizeSeverity('WARNING')).toBe('WARN');
    expect(normalizeSeverity('SEVERE')).toBe('ERROR');
    expect(normalizeSeverity('CRITICAL')).toBe('ERROR');
    expect(normalizeSeverity('FATAL')).toBe('FATAL');
  });
  it('returns null for unknown levels', () => {
    expect(normalizeSeverity('xyz')).toBeNull();
    expect(normalizeSeverity(null)).toBeNull();
  });
});

describe('parseTraceparent', () => {
  it('parses a W3C traceparent', () => {
    const r = parseTraceparent('00-a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8-0011223344556677-01');
    expect(r).toEqual({ traceId: 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8', spanId: '0011223344556677' });
  });
  it('returns null for a malformed traceparent', () => {
    expect(parseTraceparent('not-a-traceparent')).toBeNull();
    expect(parseTraceparent(null)).toBeNull();
  });
});

describe('parseLogLine — JSON Lines', () => {
  it('parses a standard JSON log line', () => {
    const line = JSON.stringify({
      timestamp: '2024-01-02T15:04:05.123Z',
      level: 'info',
      message: 'got request',
      requestId: 'req-123',
      traceId: 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8',
      spanId: '0011223344556677',
      service: 'orders',
      logger: 'c.p.Orders'
    });
    const e = parseLogLine(line);
    expect(e.severity).toBe('INFO');
    expect(e.message).toBe('got request');
    expect(e.requestId).toBe('req-123');
    expect(e.traceId).toBe('a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8');
    expect(e.spanId).toBe('0011223344556677');
    expect(e.service).toBe('orders');
    expect(e.logger).toBe('c.p.Orders');
    expect(e.timestamp).toBeGreaterThan(0);
  });

  it('preserves unrecognized fields in `fields`', () => {
    const line = JSON.stringify({ level: 'info', msg: 'hi', customField: 42, other: 'x' });
    const e = parseLogLine(line);
    expect(e.fields.customField).toBe(42);
    expect(e.fields.other).toBe('x');
    // consumed fields are not in `fields`
    expect(e.fields.level).toBeUndefined();
    expect(e.fields.msg).toBeUndefined();
  });

  it('splits a top-level traceparent into traceId + spanId', () => {
    const line = JSON.stringify({ level: 'info', msg: 'x', traceparent: '00-a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8-0011223344556677-01' });
    const e = parseLogLine(line);
    expect(e.traceId).toBe('a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8');
    expect(e.spanId).toBe('0011223344556677');
  });

  it('folds a structured exception object', () => {
    const line = JSON.stringify({ level: 'error', msg: 'boom', error: { type: 'ValueError', message: 'bad', stack: 'frame1\nframe2' } });
    const e = parseLogLine(line);
    expect(e.exception).not.toBeNull();
    expect(e.exception.type).toBe('ValueError');
    expect(e.exception.message).toBe('bad');
    expect(e.exception.stack).toContain('frame1');
  });
});

describe('parseLogLine — malformed JSON', () => {
  it('falls back to plain text for malformed JSON', () => {
    const line = '{ this is not json';
    const e = parseLogLine(line);
    expect(e.severity).toBeNull();
    expect(e.message).toBe(line);
    expect(e.raw).toBe(line);
  });
  it('does not treat a JSON array as a log line', () => {
    const e = parseLogLine('[1,2,3]');
    expect(e.severity).toBeNull();
    expect(e.message).toBe('[1,2,3]');
  });
});

describe('parseLogLine — Java / Spring Boot', () => {
  it('parses a standard Spring line with pid, thread, and logger', () => {
    const line = '2024-01-02 15:04:05.123  INFO 12345 --- [main] com.pkg.UserService : User logged in';
    const e = parseLogLine(line);
    expect(e.severity).toBe('INFO');
    expect(e.message).toBe('User logged in');
    expect(e.logger).toBe('com.pkg.UserService');
    expect(e.pid).toBe('12345');
    expect(e.fields.thread).toBe('main');
    expect(e.timestamp).toBeGreaterThan(0);
  });
  it('parses an ISO timestamp variant', () => {
    const line = '2024-01-02T15:04:05.123+00:00  WARN 1 --- [http-nio-8080-exec-1] c.p.X : slow';
    const e = parseLogLine(line);
    expect(e.severity).toBe('WARN');
    expect(e.logger).toBe('c.p.X');
  });
});

describe('parseLogLine — Node / Rails timestamped', () => {
  it('parses bracketed timestamp + level', () => {
    const e = parseLogLine('[2024-01-02T15:04:05.123Z] WARN: slow query took 1200ms');
    expect(e.severity).toBe('WARN');
    expect(e.message).toBe('slow query took 1200ms');
    expect(e.timestamp).toBeGreaterThan(0);
  });
  it('parses bare timestamp + level', () => {
    const e = parseLogLine('2024-01-02T15:04:05.123Z INFO hello world');
    expect(e.severity).toBe('INFO');
    expect(e.message).toBe('hello world');
  });
  it('does not treat a bare timestamp + non-level token as a levelled log', () => {
    const e = parseLogLine('2024-01-02T15:04:05.123Z something else');
    expect(e.severity).toBeNull();
    expect(e.message).toBe('2024-01-02T15:04:05.123Z something else');
  });
});

describe('parseLogLine — plain text fallback', () => {
  it('keeps unrecognized lines verbatim with no inferred metadata', () => {
    const e = parseLogLine('just a plain line');
    expect(e.severity).toBeNull();
    expect(e.timestamp).toBeNull();
    expect(e.message).toBe('just a plain line');
    expect(e.raw).toBe('just a plain line');
  });
});

describe('createLogParser — multiline stack traces', () => {
  it('folds Java exception continuation lines into the previous entry', () => {
    const parser = createLogParser();
    const lines = [
      '2024-01-02 15:04:05.123 ERROR 12345 --- [main] c.p.Service : oops',
      'java.lang.NullPointerException',
      '    at com.pkg.Service.handle(Service.java:42)',
      '    at com.pkg.Other.run(Other.java:7)',
      'Caused by: java.io.IOException: disk full',
      '    at com.pkg.IO.write(IO.java:10)',
      '2024-01-02 15:04:06.000  INFO 12345 --- [main] c.p.Service : recovered'
    ];
    const events = [];
    for (const l of lines) events.push(...parser.feed(l));
    events.push(...parser.end());

    // First event is the ERROR entry; the next 5 are continuations of it; the
    // last line starts a new INFO entry.
    const entryEvents = events.filter((e) => e.kind === 'entry');
    expect(entryEvents.length).toBe(2);
    expect(entryEvents[0].entry.severity).toBe('ERROR');
    // The continuations grew the message + stack.
    const errorEntry = events.filter((e) => e.kind === 'entry')[0].entry;
    expect(errorEntry.message).toContain('NullPointerException');
    expect(errorEntry.message).toContain('disk full');
    expect(errorEntry.exception.stack).toContain('Service.java:42');
    expect(errorEntry.exception.stack).toContain('IO.java:10');
    // The continuation lines were NOT emitted as separate error entries.
    expect(events.filter((e) => e.kind === 'continuation').length).toBe(5);
  });
});

describe('createLogParser — partial lines / reset', () => {
  it('reset() clears the open entry without flushing', () => {
    const parser = createLogParser();
    parser.feed('first line');
    parser.reset();
    expect(parser.openEntry).toBeNull();
  });
});
