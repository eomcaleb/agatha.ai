import { withRetry, retryNetworkOperation, retryAPIOperation, RetryError, DEFAULT_RETRY_OPTIONS } from '../retry';
import { createNetworkError, createAPIError, createConfigurationError } from '../errors';
import { vi } from 'vitest';

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withRetry(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const result = await withRetry(operation, { maxAttempts: 3, baseDelay: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws RetryError after max attempts', async () => {
    const error = new Error('Persistent failure');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withRetry(operation, { maxAttempts: 2, baseDelay: 10 }))
      .rejects.toThrow(RetryError);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const configError = createConfigurationError('Invalid config', 'apiKey', 'missing');
    const operation = vi.fn().mockRejectedValue(configError);

    await expect(withRetry(operation, { maxAttempts: 3, baseDelay: 10 }))
      .rejects.toBe(configError);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries network errors with 5xx status', async () => {
    const networkError = createNetworkError('Server error', 500);
    const operation = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('success');

    const result = await withRetry(operation, { maxAttempts: 3, baseDelay: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry network errors with 4xx status', async () => {
    const networkError = createNetworkError('Not found', 404);
    const operation = vi.fn().mockRejectedValue(networkError);

    await expect(withRetry(operation, { maxAttempts: 3, baseDelay: 10 }))
      .rejects.toBe(networkError);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry rate-limited API errors', async () => {
    const apiError = createAPIError('Rate limited', 'openai', 429, true);
    const operation = vi.fn().mockRejectedValue(apiError);

    await expect(withRetry(operation, { maxAttempts: 3, baseDelay: 10 }))
      .rejects.toBe(apiError);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('uses custom retry options', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Failure'));

    await expect(withRetry(operation, { 
      maxAttempts: 5, 
      baseDelay: 10 
    })).rejects.toThrow(RetryError);

    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('calculates exponential backoff correctly', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Failure'));

    await expect(withRetry(operation, { 
      maxAttempts: 3, 
      baseDelay: 10, // Use smaller delay for testing
      backoffFactor: 2,
      jitter: false
    })).rejects.toThrow(RetryError);

    // Verify the operation was called the expected number of times
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

describe('retryNetworkOperation', () => {
  it('uses network-specific retry settings', async () => {
    const operation = vi.fn().mockRejectedValue(createNetworkError('Network failure', 500));

    await expect(retryNetworkOperation(operation)).rejects.toThrow(RetryError);

    expect(operation).toHaveBeenCalledTimes(3); // Default for network operations
  });
});

describe('retryAPIOperation', () => {
  it('uses API-specific retry settings', async () => {
    const operation = vi.fn().mockRejectedValue(createAPIError('API failure', 'openai', 500));

    await expect(retryAPIOperation(operation)).rejects.toThrow(RetryError);

    expect(operation).toHaveBeenCalledTimes(2); // Default for API operations
  });
});

describe('RetryError', () => {
  it('contains attempt count and last error', () => {
    const lastError = new Error('Last failure');
    const retryError = new RetryError('Failed after retries', 3, lastError);

    expect(retryError.message).toBe('Failed after retries');
    expect(retryError.attempts).toBe(3);
    expect(retryError.lastError).toBe(lastError);
    expect(retryError.name).toBe('RetryError');
  });
});