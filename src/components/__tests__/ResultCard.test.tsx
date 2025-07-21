// Tests for ResultCard Component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResultCard } from '../ResultCard';
import type { SearchResult } from '../../types';

// Mock constants
jest.mock('../../constants', () => ({
  CARD_DIMENSIONS: {
    WIDTH: 400,
    HEIGHT: 600,
    MARGIN: 20,
    BORDER_RADIUS: 12,
  },
  ANIMATION_DURATIONS: {
    CARD_TRANSITION: 300,
    SCROLL_SMOOTH: 500,
    FADE_IN: 200,
    FADE_OUT: 150,
  },
}));

describe('ResultCard', () => {
  const mockResult: SearchResult = {
    id: 'test-result-1',
    url: 'https://example.com/article',
    title: 'Test Article Title',
    description: 'This is a test article description that provides some context about the content.',
    relevanceScore: 0.85,
    confidenceScore: 0.92,
    timestamp: new Date('2023-01-01T12:00:00Z'),
    metadata: {
      domain: 'example.com',
      contentType: 'text/html',
      loadStatus: 'loaded',
    },
  };

  const defaultProps = {
    result: mockResult,
    isSelected: false,
    onSelect: jest.fn(),
    onAnalyze: jest.fn(),
    onBookmark: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window.open
    global.open = jest.fn();
  });

  describe('rendering', () => {
    it('should render card with result data', () => {
      render(<ResultCard {...defaultProps} />);

      expect(screen.getByText('Test Article Title')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText(/This is a test article description/)).toBeInTheDocument();
    });

    it('should show relevance and confidence scores', () => {
      render(<ResultCard {...defaultProps} />);

      expect(screen.getByText('85% relevant')).toBeInTheDocument();
      expect(screen.getByText('92% confidence')).toBeInTheDocument();
    });

    it('should display formatted timestamp', () => {
      render(<ResultCard {...defaultProps} />);

      // Should show formatted date since it's an old timestamp
      expect(screen.getByText('1/1/2023')).toBeInTheDocument();
    });

    it('should show status indicator', () => {
      render(<ResultCard {...defaultProps} />);

      const statusIndicator = document.querySelector('.status-indicator');
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveStyle('background-color: #28a745'); // Green for loaded
    });

    it('should render action buttons when callbacks provided', () => {
      render(<ResultCard {...defaultProps} />);

      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.getByText('Bookmark')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('should not render analyze button when onAnalyze not provided', () => {
      const propsWithoutAnalyze = { ...defaultProps };
      delete propsWithoutAnalyze.onAnalyze;
      
      render(<ResultCard {...propsWithoutAnalyze} />);

      expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
      expect(screen.getByText('Bookmark')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('should not render bookmark button when onBookmark not provided', () => {
      const propsWithoutBookmark = { ...defaultProps };
      delete propsWithoutBookmark.onBookmark;
      
      render(<ResultCard {...propsWithoutBookmark} />);

      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.queryByText('Bookmark')).not.toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('should hide actions when showActions is false', () => {
      render(<ResultCard {...defaultProps} showActions={false} />);

      expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
      expect(screen.queryByText('Bookmark')).not.toBeInTheDocument();
      expect(screen.queryByText('Open')).not.toBeInTheDocument();
    });

    it('should hide metadata when showMetadata is false', () => {
      render(<ResultCard {...defaultProps} showMetadata={false} />);

      expect(screen.queryByText('85% relevant')).not.toBeInTheDocument();
      expect(screen.queryByText('92% confidence')).not.toBeInTheDocument();
      expect(screen.queryByText('1/1/2023')).not.toBeInTheDocument();
    });

    it('should render in compact mode', () => {
      render(<ResultCard {...defaultProps} compact={true} />);

      const card = document.querySelector('.result-card');
      expect(card).toHaveClass('compact');
    });

    it('should show selection indicator when selected', () => {
      render(<ResultCard {...defaultProps} isSelected={true} />);

      const card = document.querySelector('.result-card');
      expect(card).toHaveClass('selected');
      
      const selectionIndicator = document.querySelector('.selection-indicator');
      expect(selectionIndicator).toBeInTheDocument();
    });

    it('should show current state styling', () => {
      render(<ResultCard {...defaultProps} isCurrent={true} />);

      const card = document.querySelector('.result-card');
      expect(card).toHaveClass('current');
    });
  });

  describe('interactions', () => {
    it('should call onSelect when card is clicked', () => {
      render(<ResultCard {...defaultProps} />);

      const card = document.querySelector('.result-card');
      fireEvent.click(card!);

      expect(defaultProps.onSelect).toHaveBeenCalledWith('test-result-1');
    });

    it('should call onAnalyze when analyze button is clicked', () => {
      render(<ResultCard {...defaultProps} />);

      const analyzeButton = screen.getByText('Analyze');
      fireEvent.click(analyzeButton);

      expect(defaultProps.onAnalyze).toHaveBeenCalledWith('test-result-1');
    });

    it('should call onBookmark when bookmark button is clicked', () => {
      render(<ResultCard {...defaultProps} />);

      const bookmarkButton = screen.getByText('Bookmark');
      fireEvent.click(bookmarkButton);

      expect(defaultProps.onBookmark).toHaveBeenCalledWith('test-result-1');
    });

    it('should open external link when open button is clicked', () => {
      render(<ResultCard {...defaultProps} />);

      const openButton = screen.getByText('Open');
      fireEvent.click(openButton);

      expect(global.open).toHaveBeenCalledWith(
        'https://example.com/article',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should prevent event bubbling on action button clicks', () => {
      render(<ResultCard {...defaultProps} />);

      const analyzeButton = screen.getByText('Analyze');
      fireEvent.click(analyzeButton);

      // onSelect should not be called when action button is clicked
      expect(defaultProps.onSelect).not.toHaveBeenCalled();
    });

    it('should show loading state during action execution', async () => {
      render(<ResultCard {...defaultProps} />);

      const analyzeButton = screen.getByText('Analyze');
      fireEvent.click(analyzeButton);

      // Should show loading overlay
      expect(document.querySelector('.loading-overlay')).toBeInTheDocument();
      expect(document.querySelector('.spinner')).toBeInTheDocument();

      // Loading should disappear after timeout
      await waitFor(() => {
        expect(document.querySelector('.loading-overlay')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('hover effects', () => {
    it('should show hover effects on mouse enter/leave', () => {
      render(<ResultCard {...defaultProps} />);

      const card = document.querySelector('.result-card') as HTMLElement;

      // Mouse enter
      fireEvent.mouseEnter(card);
      expect(card.style.transform).toBe('translateY(-2px)');

      // Mouse leave
      fireEvent.mouseLeave(card);
      expect(card.style.transform).toBe('translateY(0px)');
    });

    it('should show preview overlay on hover in non-compact mode', () => {
      render(<ResultCard {...defaultProps} />);

      const card = document.querySelector('.result-card') as HTMLElement;
      fireEvent.mouseEnter(card);

      const previewOverlay = document.querySelector('.preview-overlay');
      expect(previewOverlay).toBeInTheDocument();
      expect(previewOverlay).toHaveTextContent('Click to view');
    });

    it('should not show preview section in compact mode', () => {
      render(<ResultCard {...defaultProps} compact={true} />);

      const previewSection = document.querySelector('.card-preview');
      expect(previewSection).not.toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    it('should show green status for loaded content', () => {
      render(<ResultCard {...defaultProps} />);

      const statusIndicator = document.querySelector('.status-indicator');
      expect(statusIndicator).toHaveStyle('background-color: #28a745');
    });

    it('should show yellow status for loading content', () => {
      const loadingResult = {
        ...mockResult,
        metadata: { ...mockResult.metadata, loadStatus: 'loading' as const },
      };

      render(<ResultCard {...defaultProps} result={loadingResult} />);

      const statusIndicator = document.querySelector('.status-indicator');
      expect(statusIndicator).toHaveStyle('background-color: #ffc107');
    });

    it('should show red status for error content', () => {
      const errorResult = {
        ...mockResult,
        metadata: { ...mockResult.metadata, loadStatus: 'error' as const },
      };

      render(<ResultCard {...defaultProps} result={errorResult} />);

      const statusIndicator = document.querySelector('.status-indicator');
      expect(statusIndicator).toHaveStyle('background-color: #dc3545');
    });
  });

  describe('relevance scoring', () => {
    it('should show green color for high relevance scores', () => {
      const highRelevanceResult = {
        ...mockResult,
        relevanceScore: 0.9,
      };

      render(<ResultCard {...defaultProps} result={highRelevanceResult} />);

      const relevanceIndicator = document.querySelector('.relevance-score div');
      expect(relevanceIndicator).toHaveStyle('background-color: #28a745');
    });

    it('should show yellow color for medium relevance scores', () => {
      const mediumRelevanceResult = {
        ...mockResult,
        relevanceScore: 0.7,
      };

      render(<ResultCard {...defaultProps} result={mediumRelevanceResult} />);

      const relevanceIndicator = document.querySelector('.relevance-score div');
      expect(relevanceIndicator).toHaveStyle('background-color: #ffc107');
    });

    it('should show red color for low relevance scores', () => {
      const lowRelevanceResult = {
        ...mockResult,
        relevanceScore: 0.3,
      };

      render(<ResultCard {...defaultProps} result={lowRelevanceResult} />);

      const relevanceIndicator = document.querySelector('.relevance-score div');
      expect(relevanceIndicator).toHaveStyle('background-color: #dc3545');
    });
  });

  describe('timestamp formatting', () => {
    it('should show "Just now" for very recent timestamps', () => {
      const recentResult = {
        ...mockResult,
        timestamp: new Date(),
      };

      render(<ResultCard {...defaultProps} result={recentResult} />);

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should show minutes ago for recent timestamps', () => {
      const recentResult = {
        ...mockResult,
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      render(<ResultCard {...defaultProps} result={recentResult} />);

      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('should show hours ago for timestamps within 24 hours', () => {
      const recentResult = {
        ...mockResult,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };

      render(<ResultCard {...defaultProps} result={recentResult} />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should show days ago for timestamps within a week', () => {
      const recentResult = {
        ...mockResult,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      };

      render(<ResultCard {...defaultProps} result={recentResult} />);

      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });
  });

  describe('image handling', () => {
    it('should handle image loading errors gracefully', () => {
      render(<ResultCard {...defaultProps} />);

      const hiddenImage = document.querySelector('img[style*="display: none"]') as HTMLImageElement;
      
      // Simulate image error
      fireEvent.error(hiddenImage);

      // Should show placeholder
      expect(screen.getByText('🌐')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper title attributes for truncated text', () => {
      render(<ResultCard {...defaultProps} />);

      const title = screen.getByText('Test Article Title');
      expect(title).toHaveAttribute('title', 'Test Article Title');

      const description = screen.getByText(/This is a test article description/);
      expect(description).toHaveAttribute('title', mockResult.description);
    });

    it('should have proper button labels and titles', () => {
      render(<ResultCard {...defaultProps} />);

      const analyzeButton = screen.getByText('Analyze');
      expect(analyzeButton).toHaveAttribute('title', 'Analyze');

      const bookmarkButton = screen.getByText('Bookmark');
      expect(bookmarkButton).toHaveAttribute('title', 'Bookmark');

      const openButton = screen.getByText('Open');
      expect(openButton).toHaveAttribute('title', 'Open');
    });

    it('should have proper status indicator title', () => {
      render(<ResultCard {...defaultProps} />);

      const statusIndicator = document.querySelector('.status-indicator');
      expect(statusIndicator).toHaveAttribute('title', 'Status: loaded');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<ResultCard {...defaultProps} className="custom-card" />);

      const card = document.querySelector('.result-card');
      expect(card).toHaveClass('custom-card');
    });
  });
});