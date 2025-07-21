import { 
  isAgathaError,
  getErrorMessage
} from '../utils/errors';
import type { 
  AgathaError, 
  NetworkError, 
  APIError, 
  ContentError, 
  ConfigurationError
} from '../types';

export interface ErrorHandlerOptions {
  onError?: (error: AgathaError, context?: string) => void;
  onRetry?: (error: AgathaError, attempt: number) => void;
  onRecovery?: (error: AgathaError, context?: string) => void;
}

export class ErrorHandler {
  private options: ErrorHandlerOptions;
  private errorCounts: Map<string, number> = new Map();

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = options;
  }

  handleError(error: unknown, context?: string): AgathaError {
    const agathaError = this.normalizeError(error);
    
    // Track error frequency
    const errorKey = `${agathaError.type}:${agathaError.message}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);
    
    // Call error callback
    this.options.onError?.(agathaError, context);
    
    // Log error with context
    this.logError(agathaError, context);
    
    return agathaError;
  }

  handleNetworkError(error: NetworkError, context?: string): NetworkError {
    console.error(`Network error in ${context || 'unknown context'}:`, {
      message: error.message,
      status: error.status,
      url: error.url
    });
    
    return error;
  }

  handleAPIError(error: APIError, context?: string): APIError {
    console.error(`API error in ${context || 'unknown context'}:`, {
      message: error.message,
      provider: error.provider,
      statusCode: error.statusCode,
      rateLimited: error.rateLimited
    });
    
    // Special handling for rate limiting
    if (error.rateLimited) {
      console.warn(`Rate limited by ${error.provider}, consider reducing request frequency`);
    }
    
    return error;
  }

  handleContentError(error: ContentError, context?: string): ContentError {
    console.error(`Content error in ${context || 'unknown context'}:`, {
      message: error.message,
      url: error.url,
      reason: error.reason
    });
    
    return error;
  }

  handleConfigurationError(error: ConfigurationError, context?: string): ConfigurationError {
    console.error(`Configuration error in ${context || 'unknown context'}:`, {
      message: error.message,
      field: error.field,
      reason: error.reason
    });
    
    return error;
  }

  getUserFriendlyMessage(error: AgathaError): string {
    switch (error.type) {
      case 'network':
        if (error.status === 404) {
          return 'The requested resource was not found. Please check the URL and try again.';
        }
        if (error.status === 403) {
          return 'Access to this resource is forbidden. Please check your permissions.';
        }
        if (error.status && error.status >= 500) {
          return 'The server is experiencing issues. Please try again later.';
        }
        return 'Network connection failed. Please check your internet connection and try again.';
        
      case 'api':
        if (error.rateLimited) {
          return `Too many requests to ${error.provider}. Please wait a moment before trying again.`;
        }
        if (error.statusCode === 401) {
          return `Invalid API key for ${error.provider}. Please check your configuration.`;
        }
        if (error.statusCode === 403) {
          return `Access denied by ${error.provider}. Please check your API key permissions.`;
        }
        return `AI service (${error.provider}) is currently unavailable. Please try again later.`;
        
      case 'content':
        switch (error.reason) {
          case 'blocked':
            return 'This website cannot be displayed due to security restrictions.';
          case 'cors':
            return 'This website blocks cross-origin requests. Content preview is not available.';
          case 'timeout':
            return 'The website took too long to load. Please try again.';
          case 'invalid':
            return 'The website content could not be processed.';
          default:
            return 'Unable to load website content.';
        }
        
      case 'configuration':
        return `Configuration issue: ${error.message}. Please check your settings.`;
        
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  getRecoveryActions(error: AgathaError): Array<{ label: string; action: () => void }> {
    const actions: Array<{ label: string; action: () => void }> = [];
    
    switch (error.type) {
      case 'network':
        actions.push({
          label: 'Retry',
          action: () => this.options.onRetry?.(error, 1)
        });
        break;
        
      case 'api':
        if (error.statusCode === 401) {
          actions.push({
            label: 'Update API Key',
            action: () => {
              // This would trigger opening the configuration panel
              console.log('Open configuration panel for API key update');
            }
          });
        } else if (!error.rateLimited) {
          actions.push({
            label: 'Retry',
            action: () => this.options.onRetry?.(error, 1)
          });
        }
        break;
        
      case 'content':
        if (error.reason === 'timeout') {
          actions.push({
            label: 'Retry',
            action: () => this.options.onRetry?.(error, 1)
          });
        }
        actions.push({
          label: 'Open in New Tab',
          action: () => window.open(error.url, '_blank')
        });
        break;
        
      case 'configuration':
        actions.push({
          label: 'Open Settings',
          action: () => {
            // This would trigger opening the configuration panel
            console.log('Open configuration panel');
          }
        });
        break;
    }
    
    return actions;
  }

  private normalizeError(error: unknown): AgathaError {
    if (isAgathaError(error)) {
      return error;
    }
    
    if (error instanceof Error) {
      // Try to classify generic errors
      if (error.message.includes('fetch')) {
        const networkError = new Error(error.message) as NetworkError;
        networkError.type = 'network';
        return networkError;
      }
      
      // Default to generic error
      const genericError = new Error(error.message) as AgathaError;
      genericError.type = 'network'; // Default type
      return genericError;
    }
    
    // Handle non-Error objects
    const unknownError = new Error(String(error)) as AgathaError;
    unknownError.type = 'network';
    return unknownError;
  }

  private logError(error: AgathaError, context?: string): void {
    const errorInfo = {
      type: error.type,
      message: error.message,
      context: context || 'unknown',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // In a real application, you might send this to an error tracking service
    console.error('Agatha Error:', errorInfo);
  }

  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  clearErrorStats(): void {
    this.errorCounts.clear();
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler({
  onError: (error, context) => {
    // Global error handling logic
    console.warn(`Global error handler: ${error.type} in ${context}`);
  }
});

// React hook for using error handler
export function useErrorHandler() {
  return globalErrorHandler;
}