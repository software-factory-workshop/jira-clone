import { list } from '@vercel/blob';
import { readGithub } from './github.mjs';
import { readDelivery } from './delivery-store.ts';
import { terminal } from './delivery-state.ts';

export interface ActiveWork {
  capturedAt: string;
  openPulls: Array<{ number: number; title: string; url: string; updatedAt: string }> | 'unavailable';
  deliveries: Array<{ id: string; phase: string; title?: string; prNumber?: number }> | 'unavailable';
  note: string;
}

/**
 * Host-derived record of work already underway, written into the sandbox
 * manifest so a run does not re-propose it. Replaces the hand-maintained
 * work-in-progress document. A failed read is reported as unavailable, never
 * as an empty backlog.
 */
export async function activeWork(githubToken: string, signal?: AbortSignal): Promise<ActiveWork> {
  const [openPulls, deliveries] = await Promise.all([openPullRequests(githubToken, signal), activeDeliveries()]);
  return {
    capturedAt: new Date().toISOString(),
    openPulls,
    deliveries,
    note: 'Open PRs and non-terminal deliveries are work in flight. Do not propose them again. Uncommitted owner direction, when relevant, is in the task brief.',
  };
}

async function openPullRequests(token: string, signal?: AbortSignal) {
  try {
    const { items } = await readGithub({ resource: 'pulls' }, token, signal) as { items: Array<{ number: number; title: string; url: string; state: string; updatedAt: string }> };
    return items.filter(item => item.state === 'open').map(({ number, title, url, updatedAt }) => ({ number, title, url, updatedAt }));
  } catch {
    return 'unavailable' as const;
  }
}

async function activeDeliveries() {
  try {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'factory/delivery/', limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const blob of page.blobs) {
        const match = /^factory\/delivery\/([a-f0-9]{64})\.json$/.exec(blob.pathname);
        if (match) ids.push(match[1]!);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const records = await Promise.all(ids.map(id => readDelivery(id).then(r => r?.state ?? null).catch(() => null)));
    return records
      .filter((record): record is NonNullable<typeof record> => !!record && !terminal(record.phase))
      .map(record => ({ id: record.id, phase: record.phase, title: record.request.title, prNumber: record.publication?.number }));
  } catch {
    return 'unavailable' as const;
  }
}
