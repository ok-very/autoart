import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import App from './App';
import { ErrorBoundary } from './ui/common/ErrorBoundary';
import { theme } from './theme';
import '@mantine/core/styles.css';
import './index.css';
import './styles/composer.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MantineProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
