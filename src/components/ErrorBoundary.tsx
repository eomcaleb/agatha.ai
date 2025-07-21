import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isAgathaError, getErrorMessage } from '../utils/errors';
import type { AgathaError } from '../types';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h2 className="error-boundary__title">Something went wrong</h2>
            <p className="error-boundary__message">
              {getErrorMessage(this.state.error)}
            </p>
            
            {isAgathaError(this.state.error) && (
              <div className="error-boundary__details">
                <p><strong>Error Type:</strong> {this.state.error.type}</p>
                {this.state.error.type === 'network' && this.state.error.status && (
                  <p><strong>Status:</strong> {this.state.error.status}</p>
                )}
                {this.state.error.type === 'api' && (
                  <p><strong>Provider:</strong> {this.state.error.provider}</p>
                )}
                {this.state.error.type === 'content' && (
                  <p><strong>URL:</strong> {this.state.error.url}</p>
                )}
                {this.state.error.type === 'configuration' && (
                  <p><strong>Field:</strong> {this.state.error.field}</p>
                )}
              </div>
            )}

            <div className="error-boundary__actions">
              <button 
                onClick={this.handleRetry}
                className="error-boundary__retry-btn"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="error-boundary__reload-btn"
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-boundary__debug">
                <summary>Error Details (Development)</summary>
                <pre>{this.state.error.stack}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}