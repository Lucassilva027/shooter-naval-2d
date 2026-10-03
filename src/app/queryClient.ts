import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (axios.isAxiosError(error) && error.response) {
            return error.response.status >= 500 && failureCount < 2;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 5_000),
      },
    },
  });
}
