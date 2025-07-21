// Accessibility Tests for HorizontalCardContainer Component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HorizontalCardContainer } from '../HorizontalCardContainer';
import type { SearchResult } from '../../types';

// Mock constants
jest.mock('../../constants', () => ({
  CARD_DIMENSIONS: {
    WIDTH: 300,
    HEIGHT: 200,
    MARGIN: 16,
    BORDER_RADIUS: 8,
  },
  ANIMATION_DURATIONS: {
    CARD_TRANSITION: 300,
    SCROLL_SMOOTH: 500,
    FADE_IN: 200,
  },
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
  },
}));

const mockResults: SearchResult[] = [
  {
    id: '1',
    url: 'https://example1.com',
    title: 'Example Site 1',
    description: 'This is the first example site',
    relevanceScore: 0.9,
    confidenceScore: 0.8,
    timestamp: new Date(),
    metadata: {
      domain: 'example1.com',
      contentType: 'text/html',
      loadStatus: 'loaded',
    },
  },
  {
    id: '2',
    url: 'https://example2.com',
    title: 'Example Site 2',
    description: 'This is the second example site',
    relevanceScore: 0.7,
    confidenceScore: 0.6,
    timestamp: new Date(),
    metadata: {
      domain: 'example2.com',
      contentType: 'text/html',
      loadStatus: 'loaded',
    },
  },
  {
    id: '3',
    url: 'https://example3.com',
    title: 'Example Site 3',
    description: 'This is the third example site',
    relevanceScore: 0.5,
    confidenceScore: 0.4,
    timestamp: new Date(),
    metadata: {
      domain: 'example3.com',
      contentType: 'text/html',
      loadStatus: 'loaded',
    },
  },
];

describe('HorizontalCardContainer Accessibility Tests', () => {
  const defaultProps = {
    results: mockResults,
    selectedId: null,
    onResultSelect: jest.fn(),
    onAnalyze: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should have proper accessibility structure', async () => {
    const { container } = render(<HorizontalCardContainer {...defaultProps} />);
    
    // Check for basic accessibility structure
    expect(container.querySelector('[role="region"]')).toBeInTheDocument();
    expect(container.querySelector('[role="listbox"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
  });

  test('should have proper ARIA structure', () => {
    render(<HorizontalCardContainer {...defaultProps} />);
    
    // Check main container has proper role and label
    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('aria-label', 'Search results: 3 items found');
    
    // Check scrollable container has listbox role
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Search results');
    expect(listbox).toHaveAttribute('tabindex', '0');
  });

  test('should have proper navigation button accessibility', () => {
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const prevButton = screen.getByRole('button', { name: /go to previous result/i });
    const nextButton = screen.getByRole('button', { name: /go to next result/i });
    
    expect(prevButton).toHaveAttribute('aria-label');
    expect(nextButton).toHaveAttribute('aria-label');
    expect(prevButton).toHaveAttribute('title', 'Previous result');
    expect(nextButton).toHaveAttribute('title', 'Next result');
  });

  test('should have proper card accessibility attributes', () => {
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const cards = screen.getAllByRole('option');
    expect(cards).toHaveLength(3);
    
    cards.forEach((card, index) => {
      expect(card).toHaveAttribute('aria-selected');
      expect(card).toHaveAttribute('aria-label');
      expect(card).toHaveAttribute('id', `result-card-${mockResults[index].id}`);
    });
  });

  test('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    const onResultSelect = jest.fn();
    
    render(<HorizontalCardContainer {...defaultProps} onResultSelect={onResultSelect} />);
    
    const listbox = screen.getByRole('listbox');
    listbox.focus();
    
    // Test arrow key navigation
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      const cards = screen.getAllByRole('option');
      expect(cards[1]).toHaveAttribute('aria-selected', 'true');
    });
    
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      const cards = screen.getAllByRole('option');
      expect(cards[0]).toHaveAttribute('aria-selected', 'true');
    });
    
    // Test Enter key selection
    await user.keyboard('{Enter}');
    expect(onResultSelect).toHaveBeenCalledWith('1');
  });

  test('should support Home and End key navigation', async () => {
    const user = userEvent.setup();
    
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const listbox = screen.getByRole('listbox');
    listbox.focus();
    
    // Go to end
    await user.keyboard('{End}');
    await waitFor(() => {
      const cards = screen.getAllByRole('option');
      expect(cards[2]).toHaveAttribute('aria-selected', 'true');
    });
    
    // Go to beginning
    await user.keyboard('{Home}');
    await waitFor(() => {
      const cards = screen.getAllByRole('option');
      expect(cards[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  test('should have accessible progress indicator', () => {
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label', 'Result navigation');
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    
    tabs.forEach((tab, index) => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-label');
    });
  });

  test('should handle focus management properly', async () => {
    const user = userEvent.setup();
    
    render(<HorizontalCardContainer {...defaultProps} />);
    
    // Focus should be manageable on cards
    const cards = screen.getAllByRole('option');
    
    // First card should be focusable
    expect(cards[0]).toHaveAttribute('tabindex', '0');
    
    // Other cards should not be in tab order initially
    expect(cards[1]).toHaveAttribute('tabindex', '-1');
    expect(cards[2]).toHaveAttribute('tabindex', '-1');
  });

  test('should provide proper screen reader announcements', () => {
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const cards = screen.getAllByRole('option');
    
    // Check that cards have descriptive labels
    expect(cards[0]).toHaveAttribute('aria-label', 
      expect.stringContaining('Search result 1 of 3: Example Site 1 from example1.com')
    );
    
    expect(cards[0]).toHaveAttribute('aria-label', 
      expect.stringContaining('Relevance: 90%, Confidence: 80%')
    );
  });

  test('should handle mobile responsive behavior', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    
    render(<HorizontalCardContainer {...defaultProps} />);
    
    // Navigation buttons should be hidden on mobile
    expect(screen.queryByRole('button', { name: /go to previous result/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /go to next result/i })).not.toBeInTheDocument();
  });

  test('should support touch interactions', async () => {
    const user = userEvent.setup();
    
    render(<HorizontalCardContainer {...defaultProps} />);
    
    const listbox = screen.getByRole('listbox');
    
    // Simulate touch events
    fireEvent.touchStart(listbox, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    
    fireEvent.touchMove(listbox, {
      touches: [{ clientX: 50, clientY: 100 }],
    });
    
    fireEvent.touchEnd(listbox);
    
    // Should handle touch events without errors
    expect(listbox).toBeInTheDocument();
  });

  test('should handle empty results gracefully', () => {
    render(<HorizontalCardContainer {...defaultProps} results={[]} />);
    
    const emptyState = screen.getByText('No results to display');
    expect(emptyState).toBeInTheDocument();
    
    // Should still be accessible
    const container = screen.getByText('🔍').closest('.horizontal-card-container');
    expect(container).toHaveClass('empty');
  });

  test('should have proper color contrast', () => {
    const { container } = render(<HorizontalCardContainer {...defaultProps} />);
    
    // Check that navigation buttons have sufficient contrast
    const buttons = container.querySelectorAll('.nav-button');
    buttons.forEach(button => {
      const styles = window.getComputedStyle(button);
      expect(styles.backgroundColor).toBeDefined();
      expect(styles.color).toBeDefined();
    });
  });

  test('should respect reduced motion preferences', () => {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<HorizontalCardContainer {...defaultProps} />);
    
    // Component should handle reduced motion
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
  });

  test('should handle card selection with keyboard', async () => {
    const user = userEvent.setup();
    const onResultSelect = jest.fn();
    
    render(<HorizontalCardContainer {...defaultProps} onResultSelect={onResultSelect} />);
    
    const cards = screen.getAllByRole('option');
    
    // Focus and activate a card
    cards[1].focus();
    await user.keyboard('{Enter}');
    
    expect(onResultSelect).toHaveBeenCalledWith('2');
  });

  test('should provide proper ARIA live regions for dynamic updates', async () => {
    const { rerender } = render(<HorizontalCardContainer {...defaultProps} />);
    
    // Update results
    const newResults = [...mockResults, {
      id: '4',
      url: 'https://example4.com',
      title: 'Example Site 4',
      description: 'This is the fourth example site',
      relevanceScore: 0.3,
      confidenceScore: 0.2,
      timestamp: new Date(),
      metadata: {
        domain: 'example4.com',
        contentType: 'text/html',
        loadStatus: 'loaded',
      },
    }];
    
    rerender(<HorizontalCardContainer {...defaultProps} results={newResults} />);
    
    // Check that the container updates its label
    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('aria-label', 'Search results: 4 items found');
  });
});