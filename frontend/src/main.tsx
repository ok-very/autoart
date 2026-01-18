import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from '@autoart/ui';
import { ToastContainer } from './ui/Toast';
import { toast } from './stores/toastStore';
import { getUserFriendlyMessage, isAuthError } from './utils/errors';
import { LAYOUT_VERSION } from './stores/workspaceStore';

// Clear corrupted workspace layout before React mounts
// This prevents crashes from incompatible persisted state
try {
  const stored = localStorage.getItem('autoart-workspace');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.layoutVersion !== LAYOUT_VERSION) {
      console.log('Clearing outdated workspace layout (version mismatch)');
      localStorage.removeItem('autoart-workspace');
    }
  }
} catch {
  // If parsing fails, clear the corrupted data
  console.log('Clearing corrupted workspace layout');
  localStorage.removeItem('autoart-workspace');
}

// CSS imports - order matters!
// 1. Tailwind base/utilities first
import './index.css';
// 2. Third-party component base styles
// import 'dockview/dist/styles/dockview.css'; // Moved to dockview-theme.css
// 3. Custom overrides last
import './styles/dockview-theme.css';
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
