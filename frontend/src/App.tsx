import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useCurrentUser } from './api/hooks';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './ui/layout/MainLayout';
import { CollectionModeProvider } from './workflows/export/context/CollectionModeProvider';


function App() {
  const { isLoading, isError, isFetching } = useCurrentUser();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [timerExpired, setTimerExpired] = useState(false);

  const isCurrentlyLoading = isLoading || isFetching;

  // Start/reset timeout timer when loading state changes
  useEffect(() => {
    if (isCurrentlyLoading) {
      setTimerExpired(false);
      const timer = setTimeout(() => setTimerExpired(true), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isCurrentlyLoading]);

  // Derive timeout message visibility
  const showTimeoutMessage = useMemo(
    () => isCurrentlyLoading && timerExpired,
    [isCurrentlyLoading, timerExpired]
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">
            A
          </div>
          <p className="text-slate-500">Loading...</p>
          {showTimeoutMessage && (
            <p className="text-xs text-slate-400 mt-2">
              Taking longer than expected. Is the backend running?
            </p>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated, show login/register routes
  if (isError || !isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated routes
  return (
    <CollectionModeProvider>
      <Routes>
        {/* Redirect auth routes to home when logged in */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        {/* Settings page (separate from MainLayout) */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* All authenticated routes use MainLayout with DockviewWorkspace */}
        {/* Navigation is handled by panels within DockviewWorkspace, not separate page routes */}
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </CollectionModeProvider>
  );
}

export default App;

