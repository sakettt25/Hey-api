const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { FileTailSource } = require('./file-tailer');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const appendLine = async (fd, line) => {
  await fsp.appendFile(fd, line + '\n');
};

let tmpdir;

beforeEach(async () => {
  tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'obs-tail-'));
});

afterEach(async () => {
  // Best-effort cleanup. On Windows the fs.watch handle / file fd can hold the
  // temp dir briefly even after stop(); force: true + recursive should remove
  // what it can. Leftover temp dirs are harmless (they live in os.tmpdir()).
  try {
    await fsp.rm(tmpdir, { recursive: true, force: true });
  } catch {
    // ignore — OS will reclaim the temp dir later
  }
  // Give the OS a tick to release file handles so the next test's mkdtemp
  // doesn't race with the previous one's teardown.
  await sleep(10);
});

describe('FileTailSource', () => {
  it('streams appended lines starting from end by default', async () => {
    const file = path.join(tmpdir, 'app.log');
    await fsp.writeFile(file, 'pre-existing line\n');
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    const lines = [];
    await tail.start({
      onLine: (l) => lines.push(l),
      onState: () => {},
      onError: () => {}
    });
    // nothing streamed yet from the pre-existing content
    expect(lines).toEqual([]);
    await appendLine(file, 'new line 1');
    await appendLine(file, 'new line 2');
    await sleep(120);
    expect(lines).toEqual(['new line 1', 'new line 2']);
    await tail.stop();
  });

  it('loads recent history when loadRecentLines is set', async () => {
    const file = path.join(tmpdir, 'app.log');
    const initial = Array.from({ length: 10 }, (_, i) => `history ${i}`).join('\n') + '\n';
    await fsp.writeFile(file, initial);
    const tail = new FileTailSource({ filePath: file, startFromEnd: true, loadRecentLines: true, recentLinesCount: 3, pollMs: 30, fs, fsp });
    const lines = [];
    await tail.start({
      onLine: (l) => lines.push(l),
      onState: () => {},
      onError: () => {}
    });
    await sleep(80);
    // last 3 of the 10 history lines
    expect(lines).toEqual(['history 7', 'history 8', 'history 9']);
    await tail.stop();
  });

  it('handles partial lines (no trailing newline) by buffering', async () => {
    const file = path.join(tmpdir, 'app.log');
    await fsp.writeFile(file, '');
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    const lines = [];
    await tail.start({
      onLine: (l) => lines.push(l),
      onState: () => {},
      onError: () => {}
    });
    await fsp.appendFile(file, 'partial'); // no newline
    await sleep(80);
    expect(lines).toEqual([]); // not emitted yet
    await fsp.appendFile(file, ' line\n'); // completes it
    await sleep(80);
    expect(lines).toEqual(['partial line']);
    await tail.stop();
  });

  it('recovers from truncation by re-reading from the start', async () => {
    const file = path.join(tmpdir, 'app.log');
    await fsp.writeFile(file, 'first\nsecond\n');
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    const lines = [];
    await tail.start({
      onLine: (l) => lines.push(l),
      onState: () => {},
      onError: () => {}
    });
    await appendLine(file, 'third');
    await sleep(80);
    expect(lines).toContain('third');
    // Truncate to empty (the realistic log-rotation pattern: `> file`), then
    // the app appends fresh content. The tailer must reset to offset 0 and
    // stream the new content from the start, not from the stale offset.
    await fsp.writeFile(file, '');
    await sleep(60);
    await appendLine(file, 'after-trunc-1');
    await appendLine(file, 'after-trunc-2');
    await sleep(120);
    expect(lines).toContain('after-trunc-1');
    expect(lines).toContain('after-trunc-2');
    // None of the new content should be sliced from the middle.
    expect(lines.some((l) => l.startsWith('-trunc') || l.startsWith('trunc-'))).toBe(false);
    await tail.stop();
  });

  it('reports a missing state when the file does not exist and keeps polling', async () => {
    const file = path.join(tmpdir, 'missing.log');
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    const states = [];
    await tail.start({
      onLine: () => {},
      onState: (s) => states.push(s),
      onError: () => {}
    });
    await sleep(60);
    expect(states).toContain('missing');
    // create the file and it should recover
    await fsp.writeFile(file, 'recovered\n');
    await sleep(80);
    await appendLine(file, 'appended');
    await sleep(80);
    expect(states).toContain('following');
    await tail.stop();
  });

  it('pause/resume stops then restarts line emission', async () => {
    const file = path.join(tmpdir, 'app.log');
    await fsp.writeFile(file, '');
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    const lines = [];
    await tail.start({
      onLine: (l) => lines.push(l),
      onState: () => {},
      onError: () => {}
    });
    tail.pause();
    expect(tail.isPaused()).toBe(true);
    await appendLine(file, 'paused-line');
    await sleep(80);
    expect(lines).toEqual([]);
    tail.resume();
    expect(tail.isPaused()).toBe(false);
    await appendLine(file, 'resumed-line');
    await sleep(80);
    expect(lines).toContain('resumed-line');
    await tail.stop();
  });

  it('never modifies or deletes the original file', async () => {
    const file = path.join(tmpdir, 'app.log');
    const content = 'original content\n';
    await fsp.writeFile(file, content);
    const tail = new FileTailSource({ filePath: file, pollMs: 30, fs, fsp });
    await tail.start({ onLine: () => {}, onState: () => {}, onError: () => {} });
    await appendLine(file, 'more');
    await sleep(80);
    await tail.stop();
    const after = await fsp.readFile(file, 'utf8');
    // Content should be the original plus only what we appended, never truncated.
    expect(after.startsWith(content)).toBe(true);
    expect(after.endsWith('more\n')).toBe(true);
  });
});
