// Tests for IframeViewer Component

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { IframeViewer } from '../IframeViewer';

// Mock constants
jest.mock('../../constants', () => ({
  IFRAME_SANDBOX_PERMISSIONS: 'allow-same-origin allow-scripts allow-forms allow-popups allow-presentation',
  ANIMATION_DURATIONS: {
    FADE_IN: 200,
  },
  ERROR_MESSAGES: {
    CONTENT_BLOCKED: 'Content could not be loaded due to security restrictions',
  },
}));

// Mock utils
jest.mock('../../utils/validation', () => ({
  isValidUrl: jest.fn((url: string) => url.startsWith('http')),
}));

jest.mock('../../utils/errors', () => ({
  createContentError: jest.fn((message: string, url: string, reason: string) => ({
    type: 'content',
    message,
    url,
    reason,
  })),
}));

describe('IframeViewer', () => {
  const defaultProps = {
    url: 'https://example.com',
    title: 'Test Website',
    onLoad: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock window.open
    global.open = jest.fn();
    
    // Mock fullscreen API
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null,
    });
    
    Element.prototype.requestFullscreen = jest.fn();
    document.exitFullscreen = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should render iframe viewer with controls', () => {
      render(<IframeViewer {...defaultProps} />);

      expect(screen.getByTitle('Test Website')).toBeInTheDocument();
      expect(screen.getByTitle('Go back')).toBeInTheDocument();
      expect(screen.getByTitle('Go forward')).toBeInTheDocument();
      expect(screen.getByTitle('Reload')).toBeInTheDocument();
      expect(screen.getByTitle('Open in new tab')).toBeInTheDocument();
    });

    it('should hide controls when showControls is false', () => {
      render(<IframeViewer {...defaultProps} showControls={false} />);

      expect(screen.queryByTitle('Go back')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Reload')).not.toBeInTheDocument();
    });

    it('should show fullscreen button when allowFullscreen is true', () => {
      render(<IframeViewer {...defaultProps} allowFullscreen={true} />);

      expect(screen.getByTitle('Enter fullscreen')).toBeInTheDocument();
    });

    it('should hide fullscreen button when allowFullscreen is false', () => {
      render(<IframeViewer {...defaultProps} allowFullscreen={false} />);

      expect(screen.queryByTitle('Enter fullscreen')).not.toBeInTheDocument();
    });

    it('should display URL in address bar', () => {
      render(<IframeViewer {...defaultProps} />);

      expect(screen.getByTitle('https://example.com')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<IframeViewer {...defaultProps} className="custom-iframe" />);

      const container = document.querySelector('.iframe-viewer');
      expect(container).toHaveClass('custom-iframe');
    });
  });

  describe('loading states', () => {
    it('should show loading state initially', () => {
      render(<IframeViewer {...defaultProps} />);

      expect(screen.getByText('Loading content...')).toBeInTheDocument();
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('should call onLoad when iframe loads successfully', async () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.load(iframe);

      expect(defaultProps.onLoad).toHaveBeenCalled();
    });

    it('should show load time after successful load', async () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      
      act(() => {
        jest.advanceTimersByTime(500);
        fireEvent.load(iframe);
      });

      await waitFor(() => {
        expect(screen.getByTitle(/Loaded in \d+ms/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error state when iframe fails to load', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      expect(screen.getByText('Failed to Load Content')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(defaultProps.onError).toHaveBeenCalled();
    });

    it('should show timeout error when loading takes too long', async () => {
      render(<IframeViewer {...defaultProps} timeout={1000} />);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Content')).toBeInTheDocument();
      });
    });

    it('should show error for invalid URL', () => {
      render(<IframeViewer {...defaultProps} url="invalid-url" />);

      expect(screen.getByText('Failed to Load Content')).toBeInTheDocument();
    });

    it('should show retry button with remaining attempts', () => {
      render(<IframeViewer {...defaultProps} retryAttempts={3} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      expect(screen.getByText('Retry (3 left)')).toBeInTheDocument();
    });

    it('should hide retry button when max attempts reached', () => {
      render(<IframeViewer {...defaultProps} retryAttempts={1} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      // First error
      expect(screen.getByText('Retry (1 left)')).toBeInTheDocument();

      // Retry and fail again
      fireEvent.click(screen.getByText('Retry (1 left)'));
      fireEvent.error(iframe);

      expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    });

    it('should show fallback content when provided', () => {
      const fallbackContent = <div>Custom fallback content</div>;
      render(<IframeViewer {...defaultProps} fallbackContent={fallbackContent} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      expect(screen.getByText('Custom fallback content')).toBeInTheDocument();
    });
  });

  describe('controls functionality', () => {
    it('should reload iframe when reload button is clicked', () => {
      render(<IframeViewer {...defaultProps} />);

      const reloadButton = screen.getByTitle('Reload');
      fireEvent.click(reloadButton);

      // Should show loading state again
      expect(screen.getByText('Loading content...')).toBeInTheDocument();
    });

    it('should open external link when external button is clicked', () => {
      render(<IframeViewer {...defaultProps} />);

      const externalButton = screen.getByTitle('Open in new tab');
      fireEvent.click(externalButton);

      expect(global.open).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should open external link from error state', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      const externalButton = screen.getByText('Open Externally');
      fireEvent.click(externalButton);

      expect(global.open).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle retry functionality', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.error(iframe);

      const retryButton = screen.getByText('Retry (3 left)');
      fireEvent.click(retryButton);

      // Should show loading state again
      expect(screen.getByText('Loading content...')).toBeInTheDocument();
      expect(screen.getByText('Retry attempt 1 of 3')).toBeInTheDocument();
    });
  });

  describe('navigation controls', () => {
    it('should have disabled back/forward buttons initially', () => {
      render(<IframeViewer {...defaultProps} />);

      const backButton = screen.getByTitle('Go back');
      const forwardButton = screen.getByTitle('Go forward');

      expect(backButton).toBeDisabled();
      expect(forwardButton).toBeDisabled();
    });

    it('should handle back navigation click', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.load(iframe);

      // Mock iframe content window
      const mockContentWindow = {
        history: {
          back: jest.fn(),
          forward: jest.fn(),
        },
      };
      
      Object.defineProperty(iframe, 'contentWindow', {
        value: mockContentWindow,
        writable: true,
      });

      const backButton = screen.getByTitle('Go back');
      fireEvent.click(backButton);

      expect(mockContentWindow.history.back).toHaveBeenCalled();
    });

    it('should handle forward navigation click', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      fireEvent.load(iframe);

      // Mock iframe content window
      const mockContentWindow = {
        history: {
          back: jest.fn(),
          forward: jest.fn(),
        },
      };
      
      Object.defineProperty(iframe, 'contentWindow', {
        value: mockContentWindow,
        writable: true,
      });

      const forwardButton = screen.getByTitle('Go forward');
      fireEvent.click(forwardButton);

      expect(mockContentWindow.history.forward).toHaveBeenCalled();
    });
  });

  describe('fullscreen functionality', () => {
    it('should toggle fullscreen when fullscreen button is clicked', async () => {
      render(<IframeViewer {...defaultProps} allowFullscreen={true} />);

      const fullscreenButton = screen.getByTitle('Enter fullscreen');
      fireEvent.click(fullscreenButton);

      expect(Element.prototype.requestFullscreen).toHaveBeenCalled();
    });

    it('should exit fullscreen when already in fullscreen', async () => {
      // Mock fullscreen state
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        writable: true,
      });

      render(<IframeViewer {...defaultProps} allowFullscreen={true} />);

      // Simulate fullscreen change event
      fireEvent(document, new Event('fullscreenchange'));

      await waitFor(() => {
        expect(screen.getByTitle('Exit fullscreen')).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByTitle('Exit fullscreen');
      fireEvent.click(fullscreenButton);

      expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it('should handle fullscreen change events', () => {
      render(<IframeViewer {...defaultProps} allowFullscreen={true} />);

      // Mock entering fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        writable: true,
      });

      fireEvent(document, new Event('fullscreenchange'));

      expect(screen.getByTitle('Exit fullscreen')).toBeInTheDocument();

      // Mock exiting fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true,
      });

      fireEvent(document, new Event('fullscreenchange'));

      expect(screen.getByTitle('Enter fullscreen')).toBeInTheDocument();
    });
  });

  describe('security attributes', () => {
    it('should set proper sandbox permissions', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      expect(iframe).toHaveAttribute(
        'sandbox',
        'allow-same-origin allow-scripts allow-forms allow-popups allow-presentation'
      );
    });

    it('should set proper referrer policy', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      expect(iframe).toHaveAttribute('referrerPolicy', 'strict-origin-when-cross-origin');
    });

    it('should set lazy loading', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      expect(iframe).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const { unmount } = render(<IframeViewer {...defaultProps} />);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<IframeViewer {...defaultProps} allowFullscreen={true} />);
      
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    });
  });

  describe('accessibility', () => {
    it('should have proper iframe title', () => {
      render(<IframeViewer {...defaultProps} />);

      const iframe = screen.getByTitle('Test Website');
      expect(iframe).toHaveAttribute('title', 'Test Website');
    });

    it('should have proper button titles', () => {
      render(<IframeViewer {...defaultProps} />);

      expect(screen.getByTitle('Go back')).toBeInTheDocument();
      expect(screen.getByTitle('Go forward')).toBeInTheDocument();
      expect(screen.getByTitle('Reload')).toBeInTheDocument();
      expect(screen.getByTitle('Open in new tab')).toBeInTheDocument();
    });

    it('should show proper disabled state for navigation buttons', () => {
      render(<IframeViewer {...defaultProps} />);

      const backButton = screen.getByTitle('Go back');
      const forwardButton = screen.getByTitle('Go forward');

      expect(backButton).toHaveStyle('opacity: 0.5');
      expect(forwardButton).toHaveStyle('opacity: 0.5');
      expect(backButton).toHaveStyle('cursor: not-allowed');
      expect(forwardButton).toHaveStyle('cursor: not-allowed');
    });
  });
});