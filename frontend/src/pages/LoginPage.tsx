import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

import { useLogin, useRegister } from '../api/hooks';
import { useAuthStore } from '../stores/authStore';
import { Button } from '@autoart/ui';

interface LoginPageProps {
  /** Initial mode for the form */
  initialMode?: 'login' | 'register';
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  // Only allow internal paths — block protocol-relative and absolute URLs
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
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
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--ws-bg, #F5F2ED)', color: 'var(--ws-fg, #2E2E2C)' }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-xl p-8"
          style={{
            backgroundColor: 'var(--ws-panel-bg, #ffffff)',
            border: '1px solid var(--ws-group-border, #D6D2CB)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
              style={{ backgroundColor: 'var(--ws-fg, #2E2E2C)', color: 'var(--ws-panel-bg, #ffffff)' }}
            >
              A
            </div>
            <span className="text-2xl font-semibold font-serif">AutoArt</span>
          </div>

          {/* Title */}
          <h1
            className="text-xl font-semibold text-center mb-6 font-serif"
            style={{ color: 'var(--ws-text-primary, #2E2E2C)' }}
          >
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>

          {/* Error Message */}
          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(140, 74, 74, 0.08)',
                border: '1px solid rgba(140, 74, 74, 0.2)',
                color: 'var(--ws-color-error, #8C4A4A)',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--ws-text-primary, #2E2E2C)' }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{
                    border: '1px solid var(--ws-group-border, #D6D2CB)',
                    color: 'var(--ws-fg, #2E2E2C)',
                    backgroundColor: 'var(--ws-panel-bg, #ffffff)',
                  }}
                  placeholder="Your name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--ws-text-primary, #2E2E2C)' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={{
                  border: '1px solid var(--ws-group-border, #D6D2CB)',
                  color: 'var(--ws-fg, #2E2E2C)',
                  backgroundColor: 'var(--ws-panel-bg, #ffffff)',
                }}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--ws-text-primary, #2E2E2C)' }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={{
                  border: '1px solid var(--ws-group-border, #D6D2CB)',
                  color: 'var(--ws-fg, #2E2E2C)',
                  backgroundColor: 'var(--ws-panel-bg, #ffffff)',
                }}
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
              <Link
                to={`/register${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                className="text-sm hover:underline"
                style={{ color: 'var(--ws-accent, #3F5C6E)' }}
              >
                Don't have an account? Sign up
              </Link>
            ) : (
              <Link
                to={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                className="text-sm hover:underline"
                style={{ color: 'var(--ws-accent, #3F5C6E)' }}
              >
                Already have an account? Sign in
              </Link>
            )}
          </div>

          {/* Demo Credentials */}
          {isLogin && (
            <div
              className="mt-6 p-3 rounded-lg text-center"
              style={{ backgroundColor: 'var(--ws-row-expanded-bg, rgba(63, 92, 110, 0.04))' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--ws-muted-fg, #6B6560)' }}>
                Demo credentials:
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--ws-mono-fg, #3A3A38)' }}>
                demo@autoart.local / demo123
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

