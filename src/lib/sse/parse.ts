export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Spec-correct SSE framing over a decoded text chunk stream. Handles CRLF/CR
 * normalisation, the one-leading-space strip on `data:` lines, multi-line
 * `data:`, comment lines (`:`), and buffered partial lines across chunks.
 */
export function createSseFrameStream(): TransformStream<string, SseFrame> {
  let buf = '';
  let eventName = 'message';
  const dataLines: string[] = [];

  const flush = (ctrl: TransformStreamDefaultController<SseFrame>) => {
    if (dataLines.length === 0) {
      eventName = 'message';
      return;
    }
    ctrl.enqueue({ event: eventName, data: dataLines.join('\n') });
    eventName = 'message';
    dataLines.length = 0;
  };

  const handleLine = (line: string, ctrl: TransformStreamDefaultController<SseFrame>) => {
    if (line === '') {
      flush(ctrl);
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
    // 'id' and 'retry' intentionally ignored -- backend emits neither.
  };

  return new TransformStream({
    transform(chunk, ctrl) {
      buf += chunk.replace(/\r\n?/g, '\n');
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        handleLine(buf.slice(0, nl), ctrl);
        buf = buf.slice(nl + 1);
      }
    },
    flush(ctrl) {
      if (buf) handleLine(buf, ctrl);
      flush(ctrl);
    },
  });
}
