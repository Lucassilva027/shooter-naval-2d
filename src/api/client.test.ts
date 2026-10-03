import { describe, expect, it } from 'vitest';
import { API_TIMEOUT_MS, apiClient } from './client';

describe('apiClient', () => {
  it('uses the configured API base URL and a finite timeout', () => {
    expect(apiClient.defaults.baseURL).toBe(import.meta.env.VITE_API_BASE_URL ?? '/api');
    expect(apiClient.defaults.timeout).toBe(API_TIMEOUT_MS);
    expect(API_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
