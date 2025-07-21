import { shouldRetry } from './errors';
import type { AgathaError } from '../types';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  jitter: true
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if this is the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Check if we should retry this error
      if (lastError instanceof Error && 'type' in lastError) {
        const agathaError = lastError as AgathaError;
        if (!shouldRetry(agathaError)) {
          throw lastError;
        }
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, config);
      
      console.warn(`Operation failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, lastError.message);
      
      await sleep(delay);
    }
  }
  
  throw new RetryError(
    `Operation failed after ${config.maxAttempts} attempts`,
    config.maxAttempts,
    lastError!
  );
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  // Calculate exponential backoff delay
  let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
  
  // Cap at maximum delay
  delay = Math.min(delay, options.maxDelay);
  
  // Add jitter to prevent thundering herd
  if (options.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  
  return Math.floor(delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Specialized retry functions for different error types
export async function retryNetworkOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true
  });
}

export async function retryAPIOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 2
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffFactor: 3,
    jitter: true
  });
}

export async function retryContentOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 2
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 500,
    maxDelay: 5000,
    backoffFactor: 2,
    jitter: false
  });
}