'use client';

import type { AposUIMessage } from '@/lib/ai/messages';
import { ApprovalCard } from '@/components/approval/ApprovalCard';
import { BlockedByCompliance } from '@/components/approval/BlockedByCompliance';

export function Transcript({
  messages,
  onApprove,
  onModify,
}: {
  messages: AposUIMessage[];
  onApprove: (threadId: string, interruptId: string, action: 'approve' | 'reject') => Promise<void>;
  onModify: (threadId: string, interruptId: string, message: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" aria-label="Conversation">
      {messages.map((message) => (
        <div key={message.id} className={message.role === 'user' ? 'self-end' : 'self-start'}>
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return (
                <p key={i} className="text-sm whitespace-pre-wrap">
                  {part.text}
                </p>
              );
            }
            if (part.type === 'data-apos-tool') {
              return (
                <div
                  key={part.id ?? i}
                  className="my-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)]"
                >
                  {part.data.capabilityId} — {part.data.phase}
                  {part.data.reason ? `: ${part.data.reason}` : ''}
                </div>
              );
            }
            if (part.type === 'data-apos-capability-status') {
              return (
                <div
                  key={part.id ?? i}
                  className="my-1 rounded border border-[var(--color-caution)] px-2 py-1 text-xs text-[var(--color-caution)]"
                >
                  {part.data.capabilityId} unavailable: {part.data.reason}
                </div>
              );
            }
            if (part.type === 'data-apos-compliance') {
              return (
                <div key={part.id ?? i} className="my-1 text-xs text-[var(--color-fg-muted)]">
                  Compliance: {part.data.status} ({part.data.ruleIds.length} rules)
                </div>
              );
            }
            if (part.type === 'data-apos-interrupt') {
              return (
                <div key={part.id ?? i} className="my-2">
                  <ApprovalCard
                    threadId={part.data.threadId}
                    interruptId={part.data.interruptId}
                    blotter={part.data.blotter}
                    onDecide={(action) =>
                      part.data.interruptId
                        ? onApprove(part.data.threadId, part.data.interruptId, action)
                        : Promise.resolve()
                    }
                    onModify={(msg) =>
                      part.data.interruptId
                        ? onModify(part.data.threadId, part.data.interruptId, msg)
                        : Promise.resolve()
                    }
                  />
                </div>
              );
            }
            if (part.type === 'data-apos-notice') {
              return (
                <div
                  key={part.id ?? i}
                  className="my-1 text-xs text-[var(--color-caution)]"
                  role={part.data.severity === 'error' ? 'alert' : undefined}
                >
                  {part.data.message}
                </div>
              );
            }
            if (part.type === 'data-apos-unknown') {
              return (
                <details key={part.id ?? i} className="my-1 text-xs text-[var(--color-fg-muted)]">
                  <summary>Unrecognized event: {part.data.rawType}</summary>
                  <pre className="overflow-x-auto">{JSON.stringify(part.data.raw, null, 2)}</pre>
                </details>
              );
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
}

export function findBlockedOutcome(
  message: AposUIMessage,
): { status: 'FAIL' | 'ERROR'; ruleIds: string[] } | null {
  const hasInterrupt = message.parts.some((p) => p.type === 'data-apos-interrupt');
  if (hasInterrupt) return null;
  const compliance = [...message.parts]
    .reverse()
    .find(
      (p): p is Extract<typeof p, { type: 'data-apos-compliance' }> =>
        p.type === 'data-apos-compliance',
    );
  if (compliance && compliance.data.status !== 'PASS') {
    return { status: compliance.data.status, ruleIds: compliance.data.ruleIds };
  }
  return null;
}

export { BlockedByCompliance };
