import { DefaultChatTransport } from 'ai';
import type { AposUIMessage } from './messages';

export type AposSendBody =
  | { kind: 'chat'; thread_id: string }
  | { kind: 'approve' | 'reject'; thread_id: string; interrupt_id: string }
  | { kind: 'modify'; thread_id: string; interrupt_id: string };

/**
 * A single transport for chat, approve/reject, and modify, so all three
 * responses are parsed through useChat's own UI-message-stream handling
 * instead of a bare `fetch()` whose SSE body is never consumed. Approve/
 * reject/modify are sent via `sendMessage(undefined, {body})` /
 * `regenerate`-style calls that append no new user bubble; the resumed
 * run's chunks land in the existing (last) assistant message because
 * AbstractChat continues a trailing assistant message rather than starting
 * a fresh one.
 */
export function createAposChatTransport() {
  return new DefaultChatTransport<AposUIMessage>({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages, body }) => {
      const send = body as AposSendBody | undefined;

      if (send?.kind === 'approve' || send?.kind === 'reject') {
        return {
          api: '/api/approve',
          body: { thread_id: send.thread_id, interrupt_id: send.interrupt_id, action: send.kind },
        };
      }

      // Both plain chat and "modify" send the last user message's text --
      // modify differs only in destination and the extra approval fields.
      const last = messages[messages.length - 1];
      const text = last?.parts.find((p) => p.type === 'text')?.text ?? '';

      if (send?.kind === 'modify') {
        return {
          api: '/api/approvals/modify',
          body: { thread_id: send.thread_id, interrupt_id: send.interrupt_id, message: text },
        };
      }

      return { api: '/api/chat', body: { message: text, thread_id: send?.thread_id } };
    },
  });
}
