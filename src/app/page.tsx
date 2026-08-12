'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { useQueryClient } from '@tanstack/react-query';
import type { AposUIMessage } from '@/lib/ai/messages';
import { createAposChatTransport } from '@/lib/ai/transport';
import { usePacksActive } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import {
  buildCapabilityIndex,
  patchCapabilityStatus,
  type PacksActive,
} from '@/lib/format/capability';
import { Header } from '@/components/layout/Header';
import { RightRail } from '@/components/layout/RightRail';
import { SpecialistModes } from '@/components/layout/SpecialistModes';
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
  const queryClient = useQueryClient();
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
    // capability.degraded/unavailable can arrive mid-stream, well before
    // run.finished. Patch the packs/active cache immediately with the SSE
    // payload (server truth, not optimism) so the right/left rails reflect
    // it live instead of waiting for the response to finish and a refetch.
    onData: (dataPart) => {
      if (dataPart.type !== 'data-apos-capability-status') return;
      const { capabilityId, status: capStatus, reason } = dataPart.data;
      queryClient.setQueryData<PacksActive>(qk.packs, (old) =>
        old ? patchCapabilityStatus(old, capabilityId, capStatus, reason) : old,
      );
    },
  });

  // Reconcile the patched cache against the descriptor's own next fetch once
  // the run truly settles -- the SSE patch is authoritative for the moment
  // it arrives, but the descriptor is the long-lived source of truth.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === 'streaming' && status !== 'streaming') {
      void queryClient.invalidateQueries({ queryKey: qk.packs });
    }
    prevStatusRef.current = status;
  }, [status, queryClient]);

  const lastMessage = messages[messages.length - 1];
  const blocked = lastMessage ? findBlockedOutcome(lastMessage) : null;

  const packs = usePacksActive();
  const index = packs.data ? buildCapabilityIndex(packs.data) : null;

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
          <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
            Threads (local to this browser)
          </p>
          {index && <SpecialistModes index={index} />}
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
