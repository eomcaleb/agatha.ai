// Iframe Viewer Component for Agatha

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IFRAME_SANDBOX_PERMISSIONS, ANIMATION_DURATIONS, ERROR_MESSAGES } from '../constants';
import { createContentError } from '../utils/errors';
import { isValidUrl } from '../utils/validation';
import type { ContentError } from '../types';

export interface IframeViewerProps {
  url: string;
  title: string;
  onLoad?: () => void;
  onError?: (error: ContentError) => void;
  className?: string;
  showControls?: boolean;
  allowFullscreen?: boolean;
  timeout?: number;
  retryAttempts?: number;
  fallbackContent?: React.ReactNode;
}

export interface IframeState {
  status: 'loading' | 'loaded' | 'error' | 'blocked' | 'timeout';
  error?: ContentError;
  loadTime?: number;
  retryCount: number;
}

export interface IframeControls {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  openExternal: () => void;
  toggleFullscreen: () => void;
}

export const IframeViewer: React.FC<IframeViewerProps> = ({
  url,
  title,
  onLoad,
  onError,
  className = '',
  showControls = true,
  allowFullscreen = true,
  timeout = 30000,
  retryAttempts = 3,
  fallbackContent,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const loadStartTime = useRef<number>();

  const [state, setState] = useState<IframeState>({
    status: 'loading',
    retryCount: 0,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Validate URL
  const isUrlValid = isValidUrl(url);

  // Handle iframe load success
  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const loadTime = loadStartTime.current ? Date.now() - loadStartTime.current : 0;

    setState(prev => ({
      ...prev,
      status: 'loaded',
      loadTime,
      error: undefined,
    }));

    onLoad?.();
  }, [onLoad]);

  // Handle iframe load error
  const handleError = useCallback((reason: 'blocked' | 'cors' | 'timeout' | 'invalid') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const error = createContentError(
      getErrorMessage(reason),
      url,
      reason
    );

    setState(prev => ({
      ...prev,
      status: 'error',
      error,
    }));

    onError?.(error);
  }, [url, onError]);

  // Handle timeout
  const handleTimeout = useCallback(() => {
    handleError('timeout');
  }, [handleError]);

  // Load iframe with timeout
  const loadIframe = useCallback(() => {
    if (!isUrlValid) {
      handleError('invalid');
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'loading',
      error: undefined,
    }));

    loadStartTime.current = Date.now();

    // Set timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(handleTimeout, timeout);

    // Try to load the iframe
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [url, isUrlValid, timeout, handleError, handleTimeout]);

  // Retry loading
  const retry = useCallback(() => {
    if (state.retryCount < retryAttempts) {
      setState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1,
      }));
      loadIframe();
    }
  }, [state.retryCount, retryAttempts, loadIframe]);

  // Reload iframe
  const reload = useCallback(() => {
    setState(prev => ({
      ...prev,
      retryCount: 0,
    }));
    loadIframe();
  }, [loadIframe]);

  // Navigation controls
  const goBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
      setCanGoBack(false); // Assume we can't go back further
    } catch (error) {
      console.warn('Cannot navigate back in iframe:', error);
    }
  }, []);

  const goForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
      setCanGoForward(false); // Assume we can't go forward further
    } catch (error) {
      console.warn('Cannot navigate forward in iframe:', error);
    }
  }, []);

  const openExternal = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  // Fullscreen controls
  const toggleFullscreen = useCallback(async () => {
    if (!allowFullscreen || !containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.warn('Fullscreen operation failed:', error);
    }
  }, [isFullscreen, allowFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load iframe on mount and URL change
  useEffect(() => {
    loadIframe();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loadIframe]);

  // Monitor iframe for navigation changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const checkNavigation = () => {
      try {
        // This will throw if cross-origin
        const currentUrl = iframe.contentWindow?.location.href;
        if (currentUrl && currentUrl !== url) {
          setCanGoBack(true);
        }
      } catch (error) {
        // Cross-origin restriction, can't check navigation
      }
    };

    iframe.addEventListener('load', checkNavigation);
    return () => iframe.removeEventListener('load', checkNavigation);
  }, [url]);

  // Get error message based on reason
  const getErrorMessage = (reason: string): string => {
    switch (reason) {
      case 'blocked':
        return ERROR_MESSAGES.CONTENT_BLOCKED;
      case 'cors':
        return 'Content blocked by CORS policy';
      case 'timeout':
        return 'Content failed to load within timeout period';
      case 'invalid':
        return 'Invalid URL provided';
      default:
        return 'Failed to load content';
    }
  };

  // Render loading state
  const renderLoading = () => (
    <div
      className="iframe-loading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#f8f9fa',
        color: '#6c757d',
      }}
    >
      <div
        className="loading-spinner"
        style={{
          width: 40,
          height: 40,
          border: '4px solid #e9ecef',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: 16,
        }}
      />
      <div style={{ fontSize: 16, marginBottom: 8 }}>Loading content...</div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>{url}</div>
      {state.retryCount > 0 && (
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>
          Retry attempt {state.retryCount} of {retryAttempts}
        </div>
      )}
    </div>
  );

  // Render error state
  const renderError = () => (
    <div
      className="iframe-error"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#f8f9fa',
        color: '#6c757d',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#dc3545' }}>
        Failed to Load Content
      </div>
      <div style={{ fontSize: 14, marginBottom: 16, maxWidth: 400 }}>
        {state.error?.message || 'An error occurred while loading the content.'}
      </div>
      <div style={{ fontSize: 12, marginBottom: 24, opacity: 0.7, wordBreak: 'break-all' }}>
        {url}
      </div>
      
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {state.retryCount < retryAttempts && (
          <button
            onClick={retry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Retry ({retryAttempts - state.retryCount} left)
          </button>
        )}
        
        <button
          onClick={reload}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Reload
        </button>
        
        <button
          onClick={openExternal}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Open Externally
        </button>
      </div>

      {fallbackContent && (
        <div style={{ marginTop: 24, width: '100%' }}>
          {fallbackContent}
        </div>
      )}
    </div>
  );

  // Render controls
  const renderControls = () => (
    <div
      className="iframe-controls"
      role="toolbar"
      aria-label="Website navigation controls"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(4px, 1vw, 8px)',
        padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef',
        fontSize: 'clamp(12px, 2.5vw, 14px)',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={goBack}
        disabled={!canGoBack}
        aria-label="Go back in website history"
        style={{
          padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: canGoBack ? 'pointer' : 'not-allowed',
          opacity: canGoBack ? 1 : 0.5,
          minWidth: '44px',
          minHeight: '44px',
          fontSize: '16px',
        }}
        title="Go back"
      >
        <span aria-hidden="true">←</span>
      </button>
      
      <button
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Go forward in website history"
        style={{
          padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: canGoForward ? 'pointer' : 'not-allowed',
          opacity: canGoForward ? 1 : 0.5,
          minWidth: '44px',
          minHeight: '44px',
          fontSize: '16px',
        }}
        title="Go forward"
      >
        <span aria-hidden="true">→</span>
      </button>
      
      <button
        onClick={reload}
        aria-label="Reload current website"
        style={{
          padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          minWidth: '44px',
          minHeight: '44px',
          fontSize: '16px',
        }}
        title="Reload"
      >
        <span aria-hidden="true">↻</span>
      </button>
      
      <div
        className="mobile-hidden"
        style={{
          flex: 1,
          padding: 'clamp(6px, 1.5vw, 8px)',
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          fontSize: 'clamp(10px, 2vw, 12px)',
          color: '#6c757d',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
        }}
        title={url}
        aria-label={`Current URL: ${url}`}
      >
        {url}
      </div>
      
      <button
        onClick={openExternal}
        aria-label="Open website in new tab"
        style={{
          padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          minWidth: '44px',
          minHeight: '44px',
          fontSize: '16px',
        }}
        title="Open in new tab"
      >
        <span aria-hidden="true">↗</span>
      </button>
      
      {allowFullscreen && (
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
          style={{
            padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
            border: '1px solid #dee2e6',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: 'pointer',
            minWidth: '44px',
            minHeight: '44px',
            fontSize: '16px',
          }}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <span aria-hidden="true">{isFullscreen ? '⤓' : '⤢'}</span>
        </button>
      )}
      
      {state.status === 'loaded' && state.loadTime && (
        <div
          className="mobile-small-hidden"
          style={{
            fontSize: 'clamp(9px, 2vw, 11px)',
            color: '#28a745',
            padding: '2px 6px',
            backgroundColor: '#d4edda',
            borderRadius: 3,
            whiteSpace: 'nowrap',
          }}
          title={`Loaded in ${state.loadTime}ms`}
          aria-label={`Page loaded in ${state.loadTime < 1000 ? `${state.loadTime} milliseconds` : `${(state.loadTime / 1000).toFixed(1)} seconds`}`}
        >
          {state.loadTime < 1000 ? `${state.loadTime}ms` : `${(state.loadTime / 1000).toFixed(1)}s`}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`iframe-viewer ${className} ${isFullscreen ? 'fullscreen' : ''}`}
      role="region"
      aria-label={`Website viewer: ${title}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        border: '1px solid #e9ecef',
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        transition: `all ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
      }}
    >
      {showControls && renderControls()}
      
      <div
        className="iframe-content"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {state.status === 'loading' && renderLoading()}
        {state.status === 'error' && renderError()}
        
        {isUrlValid && (
          <iframe
            ref={iframeRef}
            title={title}
            onLoad={handleLoad}
            onError={() => handleError('blocked')}
            sandbox={IFRAME_SANDBOX_PERMISSIONS}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: state.status === 'loaded' ? 'block' : 'none',
            }}
            // Security attributes
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        )}
      </div>

      {/* CSS animations */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .iframe-viewer.fullscreen {
            animation: fadeIn ${ANIMATION_DURATIONS.FADE_IN}ms ease;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          .iframe-controls button:hover:not(:disabled) {
            background-color: #e9ecef !important;
          }
          
          .iframe-controls button:active:not(:disabled) {
            transform: translateY(1px);
          }
        `}
      </style>
    </div>
  );
};