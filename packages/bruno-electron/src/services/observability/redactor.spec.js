const { redactEntry, redactString, sanitizeText, REDACTED } = require('./redactor');

describe('sanitizeText', () => {
  it('strips CSI color sequences', () => {
    expect(sanitizeText('hello \x1b[31mred\x1b[0m world')).toBe('hello red world');
  });
  it('strips OSC title sequences', () => {
    expect(sanitizeText('a\x1b]0;title\x07b')).toBe('ab');
  });
  it('strips other control chars but keeps tab/newline', () => {
    expect(sanitizeText('a\x00b\x07c')).toBe('abc');
    expect(sanitizeText('a\tb\nc')).toBe('a\tb\nc');
  });
});

describe('redactString — built-in patterns', () => {
  it('redacts Bearer tokens', () => {
    expect(redactString('Authorization: Bearer eyJabc.def.ghi')).toContain(REDACTED);
    expect(redactString('Authorization: Bearer eyJabc.def.ghi')).not.toContain('eyJabc.def.ghi');
  });
  it('redacts bare bearer tokens in text', () => {
    expect(redactString('Bearer eyJabc123token')).toContain(REDACTED);
  });
  it('redacts password values', () => {
    expect(redactString('password=hunter2')).toContain(REDACTED);
    expect(redactString('password: "secret123"')).toContain(REDACTED);
  });
  it('redacts api key values', () => {
    expect(redactString('api_key=abc123')).toContain(REDACTED);
    expect(redactString('x-api-key: mykey')).toContain(REDACTED);
  });
  it('redacts cookie / set-cookie headers entirely', () => {
    expect(redactString('set-cookie: session=abc; Path=/')).toContain(REDACTED);
    expect(redactString('Cookie: sid=xyz')).toContain(REDACTED);
  });
  it('redacts AWS access key ids', () => {
    expect(redactString('AKIAIOSFODNN7EXAMPLE')).toContain(REDACTED);
  });
  it('redacts PEM private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----';
    expect(redactString(pem)).toBe(REDACTED);
  });
  it('keeps non-secret content intact', () => {
    expect(redactString('user=john status=ok')).toBe('user=john status=ok');
  });
});

describe('redactString — user-configurable extra patterns', () => {
  it('applies extra patterns on top of built-ins', () => {
    const r = redactString('internal-id=12345', [/\binternal[_-]?id\s*[:=]\s*\S+/gi]);
    expect(r).toContain(REDACTED);
    expect(r).not.toContain('12345');
  });
  it('ignores invalid extra pattern regexes gracefully', () => {
    expect(() => redactString('x', ['(unclosed'])).not.toThrow();
  });
});

describe('redactEntry', () => {
  const base = (overrides) => ({
    id: '1',
    message: '',
    raw: '',
    exception: null,
    fields: {},
    ...overrides
  });

  it('redacts message, raw, and exception stack', () => {
    const entry = base({
      message: 'Authorization: Bearer secret.token',
      raw: 'Authorization: Bearer secret.token',
      exception: { type: null, message: 'password=leaked', stack: '    at x.y(z:1)' }
    });
    const r = redactEntry(entry);
    expect(r.message).toContain(REDACTED);
    expect(r.raw).toContain(REDACTED);
    expect(r.exception.message).toContain(REDACTED);
    // stack is not a secret pattern, stays intact
    expect(r.exception.stack).toBe('    at x.y(z:1)');
  });

  it('redacts fields whose key looks secret wholesale', () => {
    const entry = base({ fields: { authorization: 'Bearer x', password: 'p', normal: 'keep' } });
    const r = redactEntry(entry);
    expect(r.fields.authorization).toBe(REDACTED);
    expect(r.fields.password).toBe(REDACTED);
    expect(r.fields.normal).toBe('keep');
  });

  it('redacts nested object field values recursively', () => {
    const entry = base({ fields: { headers: { Authorization: 'Bearer abc', Accept: 'application/json' } } });
    const r = redactEntry(entry);
    expect(JSON.stringify(r.fields.headers)).toContain(REDACTED);
    expect(r.fields.headers.Accept).toBe('application/json');
  });

  it('does not mutate the input entry', () => {
    const entry = base({ message: 'password=hunter2' });
    redactEntry(entry);
    expect(entry.message).toBe('password=hunter2');
  });

  it('supports sanitizeOnly to skip secret redaction but still sanitize ANSI', () => {
    const entry = base({ message: 'password=hunter2 \x1b[31mred\x1b[0m' });
    const r = redactEntry(entry, { sanitizeOnly: true });
    expect(r.message).toContain('hunter2');
    expect(r.message).not.toContain('\x1b');
  });
});
