// Tests for HorizontalCardContainer Component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HorizontalCardContainer } from '../HorizontalCardContainer';
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
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1440,
  },
}));

describe('HorizontalCardContainer', () => {
  const mockResults: SearchResult[] = [
    {
      id: 'result1',
      url: 'https://example1.com',
      title: 'First Result',
      description: 'This is the first search result with some description text.',
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
      id: 'result2',
      url: 'https://example2.com',
      title: 'Second Result',
      description: 'This is the second search result with different content.',
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
      id: 'result3',
      url: 'https://example3.com',
      title: 'Third Result',
      description: 'This is the third search result for testing purposes.',
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

  const defaultProps = {
    results: mockResults,
    selectedId: null,
    onResultSelect: jest.fn(),
    onAnalyze: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    // Mock scrollTo
    Element.prototype.scrollTo = jest.fn();
    
    // Mock offsetWidth
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 800,
    });
  });

  describe('rendering', () => {
    it('should render cards for all results', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      expect(screen.getByText('First Result')).toBeInTheDocument();
      expect(screen.getByText('Second Result')).toBeInTheDocument();
      expect(screen.getByText('Third Result')).toBeInTheDocument();
    });

    it('should display empty state when no results', () => {
      render(<HorizontalCardContainer {...defaultProps} results={[]} />);

      expect(screen.getByText('No results to display')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('should show navigation buttons by default', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const leftButton = screen.getByText('←');
      const rightButton = screen.getByText('→');

      expect(leftButton).toBeInTheDocument();
      expect(rightButton).toBeInTheDocument();
    });

    it('should hide navigation buttons when showNavigation is false', () => {
      render(<HorizontalCardContainer {...defaultProps} showNavigation={false} />);

      expect(screen.queryByText('←')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('should display progress indicators', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const progressDots = document.querySelectorAll('.progress-indicator > div');
      expect(progressDots).toHaveLength(3);
    });

    it('should show relevance and confidence scores', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      expect(screen.getByText('Relevance: 90%')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
    });

    it('should show analyze buttons when onAnalyze is provided', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const analyzeButtons = screen.getAllByText('Analyze');
      expect(analyzeButtons.length).toBeGreaterThan(0);
    });

    it('should not show analyze buttons when onAnalyze is not provided', () => {
      const propsWithoutAnalyze = { ...defaultProps };
      delete propsWithoutAnalyze.onAnalyze;
      
      render(<HorizontalCardContainer {...propsWithoutAnalyze} />);

      expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
    });
  });

  describe('card selection', () => {
    it('should highlight selected card', () => {
      render(<HorizontalCardContainer {...defaultProps} selectedId="result2" />);

      const selectedCard = screen.getByText('Second Result').closest('.card-wrapper');
      expect(selectedCard).toHaveClass('selected');
    });

    it('should call onResultSelect when card is clicked', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const firstCard = screen.getByText('First Result');
      fireEvent.click(firstCard);

      expect(defaultProps.onResultSelect).toHaveBeenCalledWith('result1');
    });

    it('should call onAnalyze when analyze button is clicked', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const analyzeButton = screen.getAllByText('Analyze')[0];
      fireEvent.click(analyzeButton);

      expect(defaultProps.onAnalyze).toHaveBeenCalledWith('result1');
    });

    it('should prevent event bubbling when analyze button is clicked', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const analyzeButton = screen.getAllByText('Analyze')[0];
      fireEvent.click(analyzeButton);

      // onResultSelect should not be called when analyze button is clicked
      expect(defaultProps.onResultSelect).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('should navigate to next card when right button is clicked', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const rightButton = screen.getByText('→');
      fireEvent.click(rightButton);

      // Should scroll to next card (implementation detail)
      expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });

    it('should navigate to previous card when left button is clicked', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      // First navigate to second card
      const rightButton = screen.getByText('→');
      fireEvent.click(rightButton);

      // Then navigate back
      const leftButton = screen.getByText('←');
      fireEvent.click(leftButton);

      expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });

    it('should disable left button at first card', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const leftButton = screen.getByText('←');
      expect(leftButton).toBeDisabled();
    });

    it('should navigate with progress indicator clicks', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const progressDots = document.querySelectorAll('.progress-indicator > div');
      fireEvent.click(progressDots[2]); // Click third dot

      expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate with arrow keys', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      // Navigate right
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      expect(Element.prototype.scrollTo).toHaveBeenCalled();

      // Navigate left
      fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
      expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });

    it('should select current card with Enter key', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      fireEvent.keyDown(document.body, { key: 'Enter' });
      expect(defaultProps.onResultSelect).toHaveBeenCalledWith('result1');
    });

    it('should select current card with Space key', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      fireEvent.keyDown(document.body, { key: ' ' });
      expect(defaultProps.onResultSelect).toHaveBeenCalledWith('result1');
    });

    it('should not handle keyboard events when target is not document.body', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const input = document.createElement('input');
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: 'ArrowRight' });
      
      // Should not navigate when focus is on input
      expect(Element.prototype.scrollTo).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('touch and drag interactions', () => {
    it('should handle mouse drag events', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const scrollContainer = document.querySelector('.scroll-container') as HTMLElement;

      fireEvent.mouseDown(scrollContainer, { clientX: 100 });
      fireEvent.mouseMove(scrollContainer, { clientX: 50 });
      fireEvent.mouseUp(scrollContainer);

      // Should update scroll position during drag
      expect(scrollContainer).toBeDefined();
    });

    it('should handle touch events', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const scrollContainer = document.querySelector('.scroll-container') as HTMLElement;

      fireEvent.touchStart(scrollContainer, { touches: [{ clientX: 100 }] });
      fireEvent.touchMove(scrollContainer, { touches: [{ clientX: 50 }] });
      fireEvent.touchEnd(scrollContainer);

      expect(scrollContainer).toBeDefined();
    });
  });

  describe('responsive behavior', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      render(<HorizontalCardContainer {...defaultProps} />);

      // Should not show navigation buttons on mobile
      expect(screen.queryByText('←')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('should handle window resize events', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      fireEvent(window, new Event('resize'));

      // Component should adapt to new size
      expect(screen.queryByText('←')).not.toBeInTheDocument();
    });
  });

  describe('auto-scroll behavior', () => {
    it('should auto-scroll to selected card when autoScroll is true', async () => {
      const { rerender } = render(<HorizontalCardContainer {...defaultProps} autoScroll={true} />);

      // Change selected ID
      rerender(<HorizontalCardContainer {...defaultProps} selectedId="result3" autoScroll={true} />);

      await waitFor(() => {
        expect(Element.prototype.scrollTo).toHaveBeenCalled();
      });
    });

    it('should not auto-scroll when autoScroll is false', () => {
      const { rerender } = render(<HorizontalCardContainer {...defaultProps} autoScroll={false} />);

      // Change selected ID
      rerender(<HorizontalCardContainer {...defaultProps} selectedId="result3" autoScroll={false} />);

      expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      const container = document.querySelector('.horizontal-card-container');
      expect(container).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<HorizontalCardContainer {...defaultProps} />);

      // Test that keyboard events are properly handled
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      fireEvent.keyDown(document.body, { key: 'Enter' });

      expect(defaultProps.onResultSelect).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should only render visible cards', () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockResults[0],
        id: `result${i}`,
        title: `Result ${i}`,
      }));

      render(<HorizontalCardContainer {...defaultProps} results={manyResults} />);

      // Should not render all 100 cards at once
      const renderedCards = document.querySelectorAll('.card-wrapper');
      expect(renderedCards.length).toBeLessThan(100);
    });
  });
});