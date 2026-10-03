import type { QueryClient } from '@tanstack/react-query';
import type { MatchSubmission } from './contracts';
import { recordsQueryKeys, submitMatch } from './records';
import { enqueuePendingSubmission, readPendingSubmissions, removePendingSubmission } from '@/storage/pendingSubmissions';

let flushPromise: Promise<void> | null = null;
let flushRequested = false;

export async function queueMatchSubmission(
  submission: MatchSubmission,
  queryClient: QueryClient,
): Promise<boolean> {
  if (!enqueuePendingSubmission(submission)) {
    console.error('Could not persist the completed match submission; it was not sent.', submission.matchId);
    return false;
  }
  await flushPendingSubmissions(queryClient);
  return true;
}

export function flushPendingSubmissions(queryClient: QueryClient): Promise<void> {
  if (flushPromise) {
    flushRequested = true;
    return flushPromise;
  }

  flushPromise = drainQueue(queryClient)
    .catch((error: unknown) => {
      console.error('Failed while draining the pending match submission queue.', error);
    })
    .finally(() => {
      flushPromise = null;
    });
  return flushPromise;
}

async function drainQueue(queryClient: QueryClient): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const attemptedIds = new Set<string>();
  do {
    flushRequested = false;
    let acknowledgedAny = false;

    while (true) {
      const stored = readPendingSubmissions();
      if (!stored.ok) {
        console.error('Could not read the pending match submission queue.', stored.error);
        return;
      }
      const submission = stored.submissions.find((entry) => !attemptedIds.has(entry.matchId));
      if (!submission) break;

      attemptedIds.add(submission.matchId);
      try {
        const response = await submitMatch(submission);
        if (
          response.matchId !== submission.matchId ||
          (response.status !== 'created' && response.status !== 'already-recorded')
        ) {
          throw new Error(`The API returned an invalid acknowledgement for match ${submission.matchId}.`);
        }
        if (!removePendingSubmission(submission.matchId)) {
          console.error('The match was accepted, but its pending queue entry could not be removed.', submission.matchId);
          continue;
        }
        acknowledgedAny = true;
      } catch (error) {
        console.warn('Match submission remains queued and will be retried later.', {
          matchId: submission.matchId,
          error,
        });
      }
    }

    if (acknowledgedAny) {
      await queryClient.invalidateQueries({ queryKey: recordsQueryKeys.all });
    }
  } while (flushRequested);
}
