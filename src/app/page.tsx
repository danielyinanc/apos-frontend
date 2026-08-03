'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { AposUIMessage } from '@/lib/ai/messages';
import { Header } from '@/components/layout/Header';
import { RightRail } from '@/components/layout/RightRail';
import { Transcript, findBlockedOutcome, BlockedByCompliance } from '@/components/chat/Transcript';
import { Composer } from '@/components/chat/Composer';
import { StreamingLiveRegion } from '@/components/chat/StreamingLiveRegion';

export default function Page() {
  const [threadId] = useState(() => `t-${crypto.randomUUID()}`);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AposUIMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const text = last?.parts.find((p) => p.type === 'text')?.text ?? '';
          return { body: { message: text, thread_id: threadId, ...(body as object) } };
        },
      }),
    [threadId],
  );
  const { messages, sendMessage, status } = useChat<AposUIMessage>({ transport });

  const lastMessage = messages[messages.length - 1];
  const blocked = lastMessage ? findBlockedOutcome(lastMessage) : null;

  const decide = async (tid: string, interruptId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ thread_id: tid, interrupt_id: interruptId, action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `${res.status}`);
    }
  };

  const modify = async (tid: string, interruptId: string, message: string) => {
    const res = await fetch('/api/approvals/modify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ thread_id: tid, interrupt_id: interruptId, message }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `${res.status}`);
    }
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
            onSend={(message) => sendMessage({ text: message })}
          />
        </main>
        <RightRail />
      </div>
    </div>
  );
}
