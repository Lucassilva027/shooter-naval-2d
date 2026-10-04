import {
  mutationOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { MatchSubmission } from './contracts';
import { queueMatchSubmission, type MatchSubmissionStatus } from './pendingSubmissions';
import { recordsQueryKeys } from './records';

/** The submission is stored on this device and will be sent later; retrying may help. */
export class SubmissionQueuedError extends Error {
  override readonly name = 'SubmissionQueuedError';
}

/** The submission could not even be stored locally; retrying will not help. */
export class SubmissionStorageError extends Error {
  override readonly name = 'SubmissionStorageError';
}

const RETRIES = 2;

export const matchSubmissionMutationKey = [...recordsQueryKeys.all, 'submit-match'] as const;

/**
 * Registers a completed match. Each attempt persists the submission before sending it, so
 * a failed attempt, a refresh or a crash never loses it, and every retry reuses the same
 * match id (the API acknowledges duplicates as `already-recorded`).
 */
export const matchSubmissionMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationKey: matchSubmissionMutationKey,
    mutationFn: async (submission: MatchSubmission) => {
      const status = await queueMatchSubmission(submission, queryClient);
      if (status === 'queued') {
        throw new SubmissionQueuedError(`Match ${submission.matchId} is waiting to be sent.`);
      }
      if (status === 'failed') {
        throw new SubmissionStorageError(`Match ${submission.matchId} could not be stored.`);
      }
      return status;
    },
    retry: (failureCount, error) =>
      error instanceof SubmissionQueuedError && failureCount < RETRIES,
    retryDelay: (attempt) => 500 * 2 ** attempt,
    onSettled: () => queryClient.invalidateQueries({ queryKey: recordsQueryKeys.all }),
  });

export function useMatchSubmission() {
  const queryClient = useQueryClient();
  const mutation = useMutation(matchSubmissionMutationOptions(queryClient));
  return { mutation, status: submissionStatus(mutation) };
}

function submissionStatus(mutation: {
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly error: Error | null;
}): MatchSubmissionStatus | null {
  if (mutation.isPending) return 'sending';
  if (mutation.isSuccess) return 'submitted';
  if (mutation.error instanceof SubmissionQueuedError) return 'queued';
  if (mutation.error) return 'failed';
  return null;
}
