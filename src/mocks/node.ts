import { setupServer } from 'msw/node';
import { createApiHandlers } from './handlers';

export const server = setupServer(...createApiHandlers());
