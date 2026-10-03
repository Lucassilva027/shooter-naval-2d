import axios from 'axios';

export const API_TIMEOUT_MS = 10_000;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: API_TIMEOUT_MS,
});
