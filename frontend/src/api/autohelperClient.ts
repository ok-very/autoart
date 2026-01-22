/**
 * AutoHelper API Client
 * Connects to the AutoHelper backend for mail operations
 */

const AUTOHELPER_BASE = import.meta.env.VITE_AUTOHELPER_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Custom error for request timeouts
 */
export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
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

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (
        (typeof DOMException !== 'undefined' &&
          error instanceof DOMException &&
          error.name === 'AbortError') ||
        (error as Error)?.name === 'AbortError'
      ) {
        throw new RequestTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }



    if (!response.ok) {
      // Guard against non-JSON error bodies
      const contentType = response.headers.get('content-type');
      let errorMessage = response.statusText || 'Request failed';

      if (contentType?.includes('application/json')) {
        try {
          const errorData = await response.json();
           
          errorMessage = (errorData as any).detail || (errorData as any).message || errorMessage;
        } catch {
          // JSON parsing failed, use default message
        }
      } else {
        // Try text fallback for non-JSON responses
        try {
          const text = await response.text();
          if (text && text.length < 200) {
            errorMessage = text;
          }
        } catch {
          // Text parsing failed, use default message
        }
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
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
