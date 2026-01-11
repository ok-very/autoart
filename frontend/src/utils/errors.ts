import type { ApiErrorResponse } from '@autoart/shared';
import { ErrorCodes } from '@autoart/shared';

export function isApiErrorResponse(error: unknown): error is { response: { data: ApiErrorResponse } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: { data: unknown } }).response !== null &&
    'data' in (error as { response: { data: unknown } }).response &&
    typeof (error as { response: { data: { error?: unknown } } }).response.data?.error === 'object'
  );
}

export function getErrorMessage(error: unknown): string {
  if (isApiErrorResponse(error)) {
    return error.response.data.error.message;
  }

  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred.';
}

export function getErrorCode(error: unknown): string | undefined {
  if (isApiErrorResponse(error)) {
    return error.response.data.error.code;
  }
  return undefined;
}

export function isAuthError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === ErrorCodes.AUTH_REQUIRED ||
    code === ErrorCodes.AUTH_INVALID_TOKEN ||
    code === ErrorCodes.AUTH_EXPIRED_TOKEN;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error && error.message.includes('Network')) {
    return true;
  }
  return false;
}

export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  [ErrorCodes.AUTH_REQUIRED]: 'Please log in to continue.',
  [ErrorCodes.AUTH_INVALID_TOKEN]: 'Your session is invalid. Please log in again.',
  [ErrorCodes.AUTH_EXPIRED_TOKEN]: 'Your session has expired. Please log in again.',
  [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
  [ErrorCodes.FORBIDDEN]: 'Access denied.',
  [ErrorCodes.VALIDATION_FAILED]: 'Please check your input and try again.',
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource could not be found.',
  [ErrorCodes.RESOURCE_CONFLICT]: 'This operation conflicts with existing data.',
  [ErrorCodes.INTERNAL_ERROR]: 'Something went wrong. Please try again later.',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'An external service is unavailable. Please try again later.',
};

export function getUserFriendlyMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code && USER_FRIENDLY_MESSAGES[code]) {
    return USER_FRIENDLY_MESSAGES[code];
  }
  return getErrorMessage(error);
}
