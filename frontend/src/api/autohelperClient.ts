/**
 * AutoHelper API Client
 * Connects to the AutoHelper backend for mail operations
 */

const AUTOHELPER_BASE = import.meta.env.VITE_AUTOHELPER_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

class AutoHelperClient {
  private baseUrl: string;

  constructor(baseUrl: string = AUTOHELPER_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText || 'Request failed',
        }));
        throw new Error(error.detail || error.message || 'Request failed');
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const autohelperApi = new AutoHelperClient();
