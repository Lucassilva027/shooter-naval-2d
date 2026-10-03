import { setupWorker } from 'msw/browser';
import { createApiHandlers } from './handlers';

export const worker = setupWorker(...createApiHandlers());
