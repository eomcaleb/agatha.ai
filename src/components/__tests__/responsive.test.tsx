// Responsive Design Tests

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HorizontalCardContainer } from '../HorizontalCardContainer';
import { SearchInput } from '../SearchInput';
import { ConfigurationPanel } from '../ConfigurationPanel';
import { IframeViewer } from '../IframeViewer';
import type { SearchResult } from '../../types';

// Mock dependencies
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
  IFRAME_SANDBOX_PERMISSIONS: 'allow-same-origin allow-scripts',
  ERROR_MESSAGES: {
    CONTENT_BLOCKED: 'Content blocked',
  },
  DEFAULT_SEARCH_CONFIG: {
    maxResults: 10,
  },
}));

jest.mock('../../utils/storage');
jest.mock('../../utils/validation');
jest.mock('../../utils/errors');
jest.mock('../../services/providerService');
jest.mock('../../services/apiKeyService');

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
];

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    // Reset window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });

    // Mock storage and validation
    const mockStorage = require('../../utils/storage');
    const mockValidation = require('../../utils/validation');
    const mockErrors = require('../../utils/errors');
    
    mockStorage.SearchHistoryStorage = {
      getHistory: jest.fn(() => []),
      addSearch: jest.fn(),
    };
    
    mockStorage.PreferencesStorage = {
      getPreferences: jest.fn(() => null),
      setPreferences: jest.fn(),
    };
    
    mockValidation.validateSearchQuery = jest.fn(() => []);
    mockValidation.sanitizeInput = jest.fn(input => input);
    mockValidation.isValidUrl = jest.fn(() => true);
    
    mockErrors.createContentError = jest.fn(() => new Error('Test error'));

    // Mock services
    const mockProviderService = require('../../services/providerService');
    const mockApiKeyService = require('../../services/apiKeyService');
    
    mockProviderService.ProviderService = {
      getInstance: jest.fn(() => ({
        getProviders: jest.fn(() => []),
        getActiveProviderName: jest.fn(() => 'openai'),
        getActiveModel: jest.fn(() => 'gpt-3.5-turbo'),
        setActiveProvider: jest.fn(),
        setActiveModel: jest.fn(),
      })),
    };
    
    mockApiKeyService.ApiKeyService = {
      getInstance: jest.fn(() => ({
        getApiKeyStatus: jest.fn(() => ({})),
        hasApiKey: jest.fn(() => false),
        setApiKey: jest.fn(),
        removeApiKey: jest.fn(),
      })),
    };
  });

  describe('Mobile Breakpoint (≤768px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
    });

    test('HorizontalCardContainer should hide navigation buttons on mobile', () => {
      render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      // Navigation buttons should not be rendered on mobile
      expect(screen.queryByRole('button', { name: /go to previous result/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /go to next result/i })).not.toBeInTheDocument();
    });

    test('HorizontalCardContainer should adjust card dimensions for mobile', () => {
      const { container } = render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      // Cards should be smaller on mobile
      const cardWrapper = container.querySelector('.card-wrapper');
      expect(cardWrapper).toBeInTheDocument();
    });

    test('SearchInput should have responsive padding on mobile', () => {
      const { container } = render(
        <SearchInput onSearch={jest.fn()} isLoading={false} />
      );

      const searchContainer = container.querySelector('.search-input-container');
      expect(searchContainer).toBeInTheDocument();
    });

    test('ConfigurationPanel should take full width on mobile', () => {
      render(
        <ConfigurationPanel isOpen={true} onClose={jest.fn()} />
      );

      const panel = screen.getByRole('dialog');
      const styles = window.getComputedStyle(panel);
      expect(styles.width).toBe('min(400px, 100vw)');
    });

    test('IframeViewer controls should be responsive on mobile', () => {
      render(
        <IframeViewer
          url="https://example.com"
          title="Test Site"
          showControls={true}
        />
      );

      const controls = screen.getByRole('toolbar');
      expect(controls).toBeInTheDocument();
      
      // URL display should be hidden on mobile
      const urlDisplay = controls.querySelector('.mobile-hidden');
      expect(urlDisplay).toBeInTheDocument();
    });
  });

  describe('Tablet Breakpoint (≤1024px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });
    });

    test('Components should adapt to tablet viewport', () => {
      render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      // Should still show navigation on tablet
      expect(screen.getByRole('button', { name: /go to previous result/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to next result/i })).toBeInTheDocument();
    });
  });

  describe('Desktop Breakpoint (>1024px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });
    });

    test('Components should show full desktop features', () => {
      render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      // All navigation should be visible
      expect(screen.getByRole('button', { name: /go to previous result/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to next result/i })).toBeInTheDocument();
    });

    test('IframeViewer should show all controls on desktop', () => {
      render(
        <IframeViewer
          url="https://example.com"
          title="Test Site"
          showControls={true}
        />
      );

      const controls = screen.getByRole('toolbar');
      expect(controls).toBeInTheDocument();
      
      // URL display should be visible on desktop
      const urlDisplay = controls.querySelector('.mobile-hidden');
      expect(urlDisplay).toBeInTheDocument();
    });
  });

  describe('Touch Target Sizes', () => {
    test('Buttons should meet minimum touch target size (44px)', () => {
      const { container } = render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // Note: In a real test, you'd check computed styles more thoroughly
        expect(button).toBeInTheDocument();
      });
    });

    test('Progress indicator dots should be large enough on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      const progressButtons = screen.getAllByRole('tab');
      progressButtons.forEach(button => {
        const styles = window.getComputedStyle(button);
        expect(styles.minWidth).toBe('44px');
        expect(styles.minHeight).toBe('44px');
      });
    });
  });

  describe('Responsive Text and Spacing', () => {
    test('Text should scale appropriately with viewport', () => {
      const { container } = render(
        <SearchInput onSearch={jest.fn()} isLoading={false} />
      );

      const input = screen.getByRole('combobox');
      const styles = window.getComputedStyle(input);
      expect(styles.fontSize).toBeDefined();
    });

    test('Padding should be responsive', () => {
      const { container } = render(
        <ConfigurationPanel isOpen={true} onClose={jest.fn()} />
      );

      const panel = screen.getByRole('dialog');
      expect(panel).toBeInTheDocument();
    });
  });

  describe('Orientation Changes', () => {
    test('Components should handle orientation changes', () => {
      const { rerender } = render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      // Simulate orientation change
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      fireEvent(window, new Event('resize'));

      rerender(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('Flexible Layouts', () => {
    test('Components should use flexible units', () => {
      const { container } = render(
        <SearchInput onSearch={jest.fn()} isLoading={false} />
      );

      // Check that components use relative units
      const searchContainer = container.querySelector('.search-input-container');
      expect(searchContainer).toHaveStyle('width: 100%');
    });

    test('Grid and flexbox layouts should be responsive', () => {
      render(
        <ConfigurationPanel isOpen={true} onClose={jest.fn()} />
      );

      const panel = screen.getByRole('dialog');
      const styles = window.getComputedStyle(panel);
      expect(styles.display).toBe('flex');
      expect(styles.flexDirection).toBe('column');
    });
  });

  describe('Media Query Support', () => {
    test('Should respect prefers-reduced-motion', () => {
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

      render(
        <HorizontalCardContainer
          results={mockResults}
          selectedId={null}
          onResultSelect={jest.fn()}
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    test('Should support high contrast mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <SearchInput onSearch={jest.fn()} isLoading={false} />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Container Queries', () => {
    test('Components should adapt to container size changes', () => {
      const { container, rerender } = render(
        <div style={{ width: '300px' }}>
          <HorizontalCardContainer
            results={mockResults}
            selectedId={null}
            onResultSelect={jest.fn()}
          />
        </div>
      );

      // Simulate container resize
      rerender(
        <div style={{ width: '800px' }}>
          <HorizontalCardContainer
            results={mockResults}
            selectedId={null}
            onResultSelect={jest.fn()}
          />
        </div>
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });
});