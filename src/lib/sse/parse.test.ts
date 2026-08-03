import { describe, expect, it } from 'vitest';
import { createSseFrameStream, type SseFrame } from './parse';

async function collect(chunks: string[]): Promise<SseFrame[]> {
  const stream = createSseFrameStream();
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const out: SseFrame[] = [];

  const reading = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();

  for (const chunk of chunks) await writer.write(chunk);
  await writer.close();
  await reading;
  return out;
}

describe('createSseFrameStream', () => {
  it('parses a single apos event', async () => {
    const frames = await collect(['event: apos\ndata: {"a":1}\n\n']);
    expect(frames).toEqual([{ event: 'apos', data: '{"a":1}' }]);
  });

  it('handles CRLF line endings', async () => {
    const frames = await collect(['event: apos\r\ndata: {"a":1}\r\n\r\n']);
    expect(frames).toEqual([{ event: 'apos', data: '{"a":1}' }]);
  });

  it('handles a lone CR', async () => {
    const frames = await collect(['event: apos\rdata: {"a":1}\r\r']);
    expect(frames).toEqual([{ event: 'apos', data: '{"a":1}' }]);
  });

  it('joins multi-line data fields with newlines', async () => {
    const frames = await collect(['event: apos\ndata: line1\ndata: line2\n\n']);
    expect(frames).toEqual([{ event: 'apos', data: 'line1\nline2' }]);
  });

  it('ignores comment lines', async () => {
    const frames = await collect([': keepalive\nevent: apos\ndata: {}\n\n']);
    expect(frames).toEqual([{ event: 'apos', data: '{}' }]);
  });

  it('strips exactly one leading space after the colon', async () => {
    const frames = await collect(['event: apos\ndata:  {"a":1}\n\n']);
    expect(frames[0]?.data).toBe(' {"a":1}');
  });

  it('splits frames arriving across multiple chunks', async () => {
    const frames = await collect(['event: ap', 'os\ndata: {"a"', ':1}\n\n']);
    expect(frames).toEqual([{ event: 'apos', data: '{"a":1}' }]);
  });

  it('splits mid-line at arbitrary byte boundaries', async () => {
    const raw = 'event: apos\ndata: {"a":1}\n\nevent: apos\ndata: {"b":2}\n\n';
    for (let cut = 1; cut < raw.length; cut++) {
      const frames = await collect([raw.slice(0, cut), raw.slice(cut)]);
      expect(frames).toEqual([
        { event: 'apos', data: '{"a":1}' },
        { event: 'apos', data: '{"b":2}' },
      ]);
    }
  });

  it('flushes a trailing frame with no final blank line', async () => {
    const frames = await collect(['event: apos\ndata: {"a":1}']);
    expect(frames).toEqual([{ event: 'apos', data: '{"a":1}' }]);
  });

  it('parses multiple consecutive frames', async () => {
    const frames = await collect(['event: apos\ndata: {"a":1}\n\nevent: apos\ndata: {"b":2}\n\n']);
    expect(frames).toHaveLength(2);
  });

  it('preserves a non-apos event name', async () => {
    const frames = await collect(['event: ping\ndata: {}\n\n']);
    expect(frames).toEqual([{ event: 'ping', data: '{}' }]);
  });
});
