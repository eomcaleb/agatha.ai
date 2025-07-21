// Error handling utilities for Agatha

import type { AgathaError, NetworkError, APIError, ContentError, ConfigurationError } from '../types';

export function createNetworkError(message: string, status?: number, url?: string): NetworkError {
  const error = new Error(message) as NetworkError;
  error.type = 'network';
  error.status = status;
  error.url = url;
  return error;
}

export function createAPIError(
  message: string,
  provider: string,
  statusCode?: number,
  rateLimited?: boolean
): APIError {
  const error = new Error(message) as APIError;
  error.type = 'api';
  error.provider = provider;
  error.statusCode = statusCode;
  error.rateLimited = rateLimited;
  return error;
}

export function createContentError(
  message: string,
  url: string,
  reason: 'blocked' | 'cors' | 'timeout' | 'invalid'
): ContentError {
  const error = new Error(message) as ContentError;
  error.type = 'content';
  error.url = url;
  error.reason = reason;
  return error;
}

export function createConfigurationError(message: string, field: string, reason: string): ConfigurationError {
  const error = new Error(message) as ConfigurationError;
  error.type = 'configuration';
  error.field = field;
  error.reason = reason;
  return error;
}

export function isAgathaError(error: unknown): error is AgathaError {
  return error instanceof Error && 'type' in error;
}

export function getErrorMessage(error: unknown): string {
  if (isAgathaError(error)) {
    switch (error.type) {
      case 'network':
        return `Network error: ${error.message}${error.status ? ` (${error.status})` : ''}`;
      case 'api':
        return `API error from ${error.provider}: ${error.message}`;
      case 'content':
        return `Content error for ${error.url}: ${error.message}`;
      case 'configuration':
        return `Configuration error in ${error.field}: ${error.message}`;
      default:
        return error.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}

export function shouldRetry(error: AgathaError): boolean {
  switch (error.type) {
    case 'network':
      // Retry on network errors except for client errors (4xx)
      return !error.status || error.status >= 500;
    case 'api':
      // Don't retry on rate limits or client errors
      return !error.rateLimited && (!error.statusCode || error.statusCode >= 500);
    case 'content':
      // Only retry on timeout errors
      return error.reason === 'timeout';
    case 'configuration':
      // Never retry configuration errors
      return false;
    default:
      return false;
  }
}