import { ErrorHandler, globalErrorHandler } from '../errorHandler';
import { 
  createNetworkError, 
  createAPIError, 
  createContentError, 
  createConfigurationError 
} from '../../utils/errors';
import { vi } from 'vitest';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockOnError: ReturnType<typeof vi.fn>;
  let mockOnRetry: ReturnType<typeof vi.fn>;
  let mockOnRecovery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnError = vi.fn();
    mockOnRetry = vi.fn();
    mockOnRecovery = vi.fn();
    
    errorHandler = new ErrorHandler({
      onError: mockOnError,
      onRetry: mockOnRetry,
      onRecovery: mockOnRecovery
    });

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleError', () => {
    it('handles Agatha errors correctly', () => {
      const networkError = createNetworkError('Network failed', 404);
      
      const result = errorHandler.handleError(networkError, 'test context');
      
      expect(result).toBe(networkError);
      expect(mockOnError).toHaveBeenCalledWith(networkError, 'test context');
    });

    it('normalizes generic errors', () => {
      const genericError = new Error('Generic error');
      
      const result = errorHandler.handleError(genericError, 'test context');
      
      expect(result.type).toBe('network');
      expect(result.message).toBe('Generic error');
      expect(mockOnError).toHaveBeenCalled();
    });

    it('handles non-Error objects', () => {
      const result = errorHandler.handleError('String error', 'test context');
      
      expect(result.type).toBe('network');
      expect(result.message).toBe('String error');
    });

    it('tracks error frequency', () => {
      const error = createNetworkError('Repeated error');
      
      errorHandler.handleError(error);
      errorHandler.handleError(error);
      
      const stats = errorHandler.getErrorStats();
      expect(stats['network:Repeated error']).toBe(2);
    });
  });

  describe('handleNetworkError', () => {
    it('logs network error details', () => {
      const networkError = createNetworkError('Network failed', 404, 'https://example.com');
      
      errorHandler.handleNetworkError(networkError, 'search service');
      
      expect(console.error).toHaveBeenCalledWith(
        'Network error in search service:',
        expect.objectContaining({
          message: 'Network failed',
          status: 404,
          url: 'https://example.com'
        })
      );
    });
  });

  describe('handleAPIError', () => {
    it('logs API error details', () => {
      const apiError = createAPIError('API failed', 'openai', 401);
      
      errorHandler.handleAPIError(apiError, 'analysis service');
      
      expect(console.error).toHaveBeenCalledWith(
        'API error in analysis service:',
        expect.objectContaining({
          message: 'API failed',
          provider: 'openai',
          statusCode: 401
        })
      );
    });

    it('warns about rate limiting', () => {
      const apiError = createAPIError('Rate limited', 'openai', 429, true);
      
      errorHandler.handleAPIError(apiError);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Rate limited by openai, consider reducing request frequency'
      );
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns friendly message for network 404 error', () => {
      const error = createNetworkError('Not found', 404);
      
      const message = errorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('The requested resource was not found. Please check the URL and try again.');
    });

    it('returns friendly message for API rate limit error', () => {
      const error = createAPIError('Rate limited', 'openai', 429, true);
      
      const message = errorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('Too many requests to openai. Please wait a moment before trying again.');
    });

    it('returns friendly message for content CORS error', () => {
      const error = createContentError('CORS blocked', 'https://example.com', 'cors');
      
      const message = errorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('This website blocks cross-origin requests. Content preview is not available.');
    });

    it('returns friendly message for configuration error', () => {
      const error = createConfigurationError('Missing API key', 'apiKey', 'required');
      
      const message = errorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('Configuration issue: Missing API key. Please check your settings.');
    });
  });

  describe('getRecoveryActions', () => {
    it('provides retry action for network errors', () => {
      const error = createNetworkError('Network failed', 500);
      
      const actions = errorHandler.getRecoveryActions(error);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].label).toBe('Retry');
    });

    it('provides API key update action for 401 API errors', () => {
      const error = createAPIError('Unauthorized', 'openai', 401);
      
      const actions = errorHandler.getRecoveryActions(error);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].label).toBe('Update API Key');
    });

    it('provides multiple actions for content errors', () => {
      const error = createContentError('Timeout', 'https://example.com', 'timeout');
      
      const actions = errorHandler.getRecoveryActions(error);
      
      expect(actions).toHaveLength(2);
      expect(actions[0].label).toBe('Retry');
      expect(actions[1].label).toBe('Open in New Tab');
    });

    it('provides settings action for configuration errors', () => {
      const error = createConfigurationError('Invalid config', 'provider', 'invalid');
      
      const actions = errorHandler.getRecoveryActions(error);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].label).toBe('Open Settings');
    });

    it('does not provide retry for rate-limited errors', () => {
      const error = createAPIError('Rate limited', 'openai', 429, true);
      
      const actions = errorHandler.getRecoveryActions(error);
      
      expect(actions).toHaveLength(0);
    });
  });

  describe('error statistics', () => {
    it('tracks and returns error statistics', () => {
      const error1 = createNetworkError('Error 1');
      const error2 = createAPIError('Error 2', 'openai');
      
      errorHandler.handleError(error1);
      errorHandler.handleError(error1);
      errorHandler.handleError(error2);
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats['network:Error 1']).toBe(2);
      expect(stats['api:Error 2']).toBe(1);
    });

    it('clears error statistics', () => {
      const error = createNetworkError('Error');
      errorHandler.handleError(error);
      
      errorHandler.clearErrorStats();
      
      const stats = errorHandler.getErrorStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });
});

describe('globalErrorHandler', () => {
  it('is available as singleton instance', () => {
    expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
  });

  it('handles errors globally', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = createNetworkError('Global error');
    
    globalErrorHandler.handleError(error, 'global context');
    
    expect(console.warn).toHaveBeenCalledWith(
      'Global error handler: network in global context'
    );
    
    vi.restoreAllMocks();
  });
});