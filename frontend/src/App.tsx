import { Routes, Route, Navigate } from 'react-router-dom';
import { useCurrentUser } from './api/hooks';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { RecordsPage } from './pages/RecordsPage';

function App() {
  const { isLoading, isError } = useCurrentUser();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">
            A
          </div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login
  if (isError || !isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/project/:projectId" element={<MainLayout />} />
      <Route path="/records" element={<RecordsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
