import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@/app/queryClient';
import { App } from '@/app/App';
import '@/ui/styles/global.css';
import '@/ui/styles/ui-kit.css';

const queryClient = createAppQueryClient();

async function startApp() {
  if (import.meta.env.VITE_API_MOCKING !== 'false') {
    try {
      const { worker } = await import('@/mocks/browser');
      await worker.start({ onUnhandledRequest: 'bypass' });
    } catch (error) {
      console.error('Failed to start the mock API worker; API calls will use the configured backend.', error);
    }
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element #root not found');

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void startApp();
