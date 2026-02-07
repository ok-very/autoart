// In production, set VITE_API_URL to the backend URL (e.g., https://backend-xxx.onrender.com/api)
// In development, Vite proxies /api to localhost:3001
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Custom error class that preserves HTTP status and backend error code.
 * Without this, all API errors became plain Error('Request failed') and
 * isAuthError() could never detect 401s — causing the retry cascade.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

type SessionExpiredCallback = () => void;

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private onSessionExpired: SessionExpiredCallback | null = null;
  /** True once session expiry has fired; prevents further authenticated requests. */
  private sessionDead = false;
  /** Deduplicates concurrent refresh attempts. */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Register a callback invoked once when token refresh fails.
   * The callback should clear auth state and redirect to login.
   */
  setSessionExpiredHandler(handler: SessionExpiredCallback) {
    this.onSessionExpired = handler;
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
      // New valid token means the session is alive again (post-login).
      this.sessionDead = false;
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('accessToken');
    }
    return this.accessToken;
  }

  setRefreshToken(token: string | null) {
    this.refreshTokenValue = token;
    if (token) {
      localStorage.setItem('refreshToken', token);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }

  getRefreshToken(): string | null {
    if (!this.refreshTokenValue) {
      this.refreshTokenValue = localStorage.getItem('refreshToken');
    }
    return this.refreshTokenValue;
  }

  private async refreshToken(): Promise<boolean> {
    // If a refresh is already in flight, piggyback on it instead of
    // firing a parallel request for every queued 401.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<boolean> {
    const token = this.getRefreshToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.accessToken);
        this.setRefreshToken(data.refreshToken);
        return true;
      }
    } catch {
      // Network error during refresh — treat as failed.
    }

    // Refresh failed. Mark session dead so no further requests attempt auth.
    this.handleSessionExpired();
    return false;
  }

  private handleSessionExpired() {
    if (this.sessionDead) return; // Already fired.
    this.sessionDead = true;

    // Clear tokens so nothing tries to use them.
    this.setToken(null);
    this.setRefreshToken(null);

    // Notify the app (clears auth store, cancels queries, redirects).
    this.onSessionExpired?.();
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;

    // If the session is dead, fail fast instead of hammering the backend.
    if (this.sessionDead && !skipAuth) {
      throw new ApiError(401, 'Session expired', 'AUTH_EXPIRED_TOKEN');
    }

    const headers = new Headers(fetchOptions.headers);

    // Only set Content-Type for non-FormData requests with a body.
    // FormData sets its own multipart boundary header via the browser.
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (!skipAuth && this.getToken()) {
      headers.set('Authorization', `Bearer ${this.getToken()}`);
    }

    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Handle token expiry — attempt refresh exactly once.
    if (response.status === 401 && !skipAuth) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.getToken()}`);
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...fetchOptions,
          headers,
        });
      }
      // If refresh failed, handleSessionExpired was already called inside refreshToken().
      // Fall through to the !response.ok block below which will throw ApiError.
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      // Backend returns { error: { code, message } }
      const code = body?.error?.code as string | undefined;
      const message = body?.error?.message || body?.message || response.statusText || 'Request failed';
      throw new ApiError(response.status, message, code);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
