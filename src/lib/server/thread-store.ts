import 'server-only';

/**
 * BFF-owned thread store -- a shim for the `GET /api/threads/{id}` endpoint
 * apos-backend does not have. Backend threads live only in the LangGraph
 * checkpointer with no HTTP read path, so this proxy records what it already
 * observes streaming past it (every envelope) and serves its own thread
 * list + pending-interrupt lookup. Delete this file the day the backend
 * ships a real thread endpoint.
 *
 * In-memory by design: a Next dev/single-instance deployment. A multi-replica
 * deployment needs a shared implementation behind this same interface.
 */

export interface ThreadRecord {
  threadId: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  lastRunId?: string;
  lastSeq: number;
  pendingInterrupt?: {
    interruptId: string | null;
    blotter: unknown;
    capturedAtMs: number;
  };
}

export interface ThreadStore {
  list(): ThreadRecord[];
  get(threadId: string): ThreadRecord | undefined;
  touch(threadId: string, patch: Partial<Omit<ThreadRecord, 'threadId'>>): ThreadRecord;
  setPendingInterrupt(threadId: string, pending: ThreadRecord['pendingInterrupt']): void;
  clearPendingInterrupt(threadId: string): void;
}

class InMemoryThreadStore implements ThreadStore {
  private readonly threads = new Map<string, ThreadRecord>();

  list(): ThreadRecord[] {
    return [...this.threads.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  get(threadId: string): ThreadRecord | undefined {
    return this.threads.get(threadId);
  }

  touch(threadId: string, patch: Partial<Omit<ThreadRecord, 'threadId'>>): ThreadRecord {
    const now = Date.now();
    const existing = this.threads.get(threadId);
    const record: ThreadRecord = existing
      ? { ...existing, ...patch, updatedAtMs: now }
      : {
          threadId,
          title: patch.title ?? 'New thread',
          createdAtMs: now,
          updatedAtMs: now,
          lastSeq: patch.lastSeq ?? 0,
          ...patch,
        };
    this.threads.set(threadId, record);
    return record;
  }

  setPendingInterrupt(threadId: string, pending: ThreadRecord['pendingInterrupt']): void {
    this.touch(threadId, { pendingInterrupt: pending });
  }

  clearPendingInterrupt(threadId: string): void {
    const existing = this.threads.get(threadId);
    if (existing) this.touch(threadId, { pendingInterrupt: undefined });
  }
}

// Module-scope singleton: survives across requests within one Node process.
const globalForStore = globalThis as unknown as { __aposThreadStore?: ThreadStore };
export const threadStore: ThreadStore =
  globalForStore.__aposThreadStore ??
  (globalForStore.__aposThreadStore = new InMemoryThreadStore());
