'use client';

import { useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { AposUIMessage } from '@/lib/ai/messages';
import { createAposChatTransport } from '@/lib/ai/transport';
import { Header } from '@/components/layout/Header';
import { RightRail } from '@/components/layout/RightRail';
import { Transcript, findBlockedOutcome, BlockedByCompliance } from '@/components/chat/Transcript';
import { Composer } from '@/components/chat/Composer';
import { StreamingLiveRegion } from '@/components/chat/StreamingLiveRegion';

export default function Page() {
  const [threadId] = useState(() => `t-${crypto.randomUUID()}`);
  const transport = useMemo(() => createAposChatTransport(), []);

  // sendMessage()'s promise resolves even when the transport request fails
  // (HTTP errors and network errors alike funnel into useChat's own `error`
  // state via onError) -- it never rejects. A ref is the only way to read
  // that failure synchronously right after the await below, since the
  // `error` binding closed over by `decide`/`modify` is fixed at the time
  // those closures were created, not live-updated by later renders.
  const lastErrorRef = useRef<Error | null>(null);
  const { messages, sendMessage, status, clearError } = useChat<AposUIMessage>({
    transport,
    onError: (err) => {
      // The transport's error message is the raw response body text (often
      // an RFC 9457 problem+json document from our route handlers) --
      // surface `detail` when present instead of a raw JSON blob.
      let message = err.message;
      try {
        const problem = JSON.parse(err.message) as { detail?: unknown };
        if (typeof problem.detail === 'string') message = problem.detail;
      } catch {
        // not JSON -- use the message as-is
      }
      lastErrorRef.current = new Error(message);
    },
  });

  const lastMessage = messages[messages.length - 1];
  const blocked = lastMessage ? findBlockedOutcome(lastMessage) : null;

  const decide = async (tid: string, interruptId: string, action: 'approve' | 'reject') => {
    lastErrorRef.current = null;
    clearError();
    await sendMessage(undefined, {
      body: { kind: action, thread_id: tid, interrupt_id: interruptId },
    });
    if (lastErrorRef.current) throw lastErrorRef.current;
  };

  const modify = async (tid: string, interruptId: string, message: string) => {
    lastErrorRef.current = null;
    clearError();
    await sendMessage(
      { text: message },
      { body: { kind: 'modify', thread_id: tid, interrupt_id: interruptId } },
    );
    if (lastErrorRef.current) throw lastErrorRef.current;
  };

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <Header />
      <div className="grid grid-cols-[280px_1fr_360px] overflow-hidden">
        <aside className="border-r border-[var(--color-border)] p-3">
          <p className="text-sm text-[var(--color-fg-muted)]">Threads (local to this browser)</p>
        </aside>
        <main className="flex flex-col overflow-hidden">
          <StreamingLiveRegion status={status === 'streaming' ? 'Response streaming' : 'Ready'} />
          <Transcript messages={messages} onApprove={decide} onModify={modify} />
          {blocked && (
            <div className="p-4">
              <BlockedByCompliance {...blocked} />
            </div>
          )}
          <Composer
            disabled={status === 'streaming' || status === 'submitted'}
            onSend={(message) =>
              sendMessage({ text: message }, { body: { kind: 'chat', thread_id: threadId } })
            }
          />
        </main>
        <RightRail />
      </div>
    </div>
  );
}
