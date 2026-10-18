const p = require('../packages/bruno-electron/src/services/observability/parser');
const r = require('../packages/bruno-electron/src/services/observability/redactor');

const samples = [
  '2024-01-02 15:04:05.123  INFO 12345 --- [main] com.pkg.UserService : User logged in',
  '{"timestamp":"2024-01-02T15:04:05.123Z","level":"info","message":"got request","requestId":"req-123","traceId":"a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8","spanId":"0011223344556677"}',
  '[2024-01-02T15:04:05.123Z] WARN: slow query took 1200ms',
  'plain text line with no metadata',
  'java.lang.NullPointerException',
  '    at com.pkg.UserService.handle(UserService.java:42)',
  'Caused by: java.io.IOException: disk full'
];

const parser = p.createLogParser();
console.log('=== Parser ===');
for (const line of samples) {
  const evs = parser.feed(line);
  for (const e of evs) {
    console.log(e.kind, JSON.stringify({
      sev: e.entry.severity,
      msg: (e.entry.message || '').slice(0, 50),
      req: e.entry.requestId,
      trace: e.entry.traceId,
      logger: e.entry.logger,
      pid: e.entry.pid,
      ts: e.entry.timestamp
    }));
  }
}
parser.end();

console.log('\n=== Redactor ===');
const red = r.redactEntry({
  id: '1',
  message: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0 and password=hunter2 api_key=abc123',
  raw: '',
  fields: { 'x-api-key': 'secret-value', cookie: 'session=abc; token=xyz', normal: 'keep' },
  exception: null
});
console.log(JSON.stringify(red, null, 2));

console.log('\n=== ANSI sanitize ===');
console.log(JSON.stringify(r.sanitizeText('hello \x1b[31mred\x1b[0m world \x1b]0;title\x07 end')));
