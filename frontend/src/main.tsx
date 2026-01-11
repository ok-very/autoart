import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './ui/common/ErrorBoundary';
import { ToastContainer } from './ui/Toast';
import { toast } from './stores/toastStore';
import { getUserFriendlyMessage, isAuthError } from './utils/errors';
import './index.css';
import './styles/composer.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        const message = getUserFriendlyMessage(error);
        toast.error(message);
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ToastContainer />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
