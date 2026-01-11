// In production, set VITE_API_URL to the backend URL (e.g., https://backend-xxx.onrender.com/api)
// In development, Vite proxies /api to localhost:3001
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
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
      // Ignore errors
    }
    return false;
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers);

    // Only set Content-Type for requests with a body
    if (fetchOptions.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (!skipAuth && this.getToken()) {
      headers.set('Authorization', `Bearer ${this.getToken()}`);
    }

    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Handle token expiry
    if (response.status === 401 && !skipAuth) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.getToken()}`);
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...fetchOptions,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText || 'Request failed'
      }));
      throw new Error(error.message || 'Request failed');
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
      body: body ? JSON.stringify(body) : undefined,
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
