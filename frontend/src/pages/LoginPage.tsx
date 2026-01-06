import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLogin, useRegister } from '../api/hooks';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';

interface LoginPageProps {
  /** Initial mode for the form */
  initialMode?: 'login' | 'register';
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const setUser = useAuthStore((s) => s.setUser);

  const isLogin = initialMode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const result = await login.mutateAsync({ email, password });
        setUser(result.user);
      } else {
        const result = await register.mutateAsync({ email, password, name });
        setUser(result.user);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              A
            </div>
            <span className="text-2xl font-bold text-slate-800">AutoArt</span>
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-center text-slate-700 mb-6">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending || register.isPending}
            >
              {login.isPending || register.isPending
                ? 'Please wait...'
                : isLogin
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>

          {/* Toggle - Link to other route */}
          <div className="mt-6 text-center">
            {isLogin ? (
              <Link to="/register" className="text-sm text-blue-600 hover:underline">
                Don't have an account? Sign up
              </Link>
            ) : (
              <Link to="/login" className="text-sm text-blue-600 hover:underline">
                Already have an account? Sign in
              </Link>
            )}
          </div>

          {/* Demo Credentials */}
          {isLogin && (
            <div className="mt-6 p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">Demo credentials:</p>
              <p className="text-xs font-mono text-slate-600">
                demo@autoart.local / demo123
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

