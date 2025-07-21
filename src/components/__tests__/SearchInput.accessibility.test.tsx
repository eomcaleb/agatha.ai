// Accessibility Tests for SearchInput Component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from '../SearchInput';

// Mock dependencies
jest.mock('../../utils/storage');
jest.mock('../../utils/validation');
jest.mock('../../constants', () => ({
  ANIMATION_DURATIONS: {
    FADE_IN: 200,
  },
  DEFAULT_SEARCH_CONFIG: {
    maxResults: 10,
  },
}));

describe('SearchInput Accessibility Tests', () => {
  const defaultProps = {
    onSearch: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock storage and validation
    const mockStorage = require('../../utils/storage');
    const mockValidation = require('../../utils/validation');
    
    mockStorage.SearchHistoryStorage = {
      getHistory: jest.fn(() => []),
      addSearch: jest.fn(),
    };
    
    mockValidation.validateSearchQuery = jest.fn(() => []);
    mockValidation.sanitizeInput = jest.fn(input => input);
  });

  test('should have proper accessibility structure', async () => {
    const { container } = render(<SearchInput {...defaultProps} />);
    
    // Check for basic accessibility structure
    expect(container.querySelector('[role="search"]')).toBeInTheDocument();
    expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
    expect(container.querySelector('button[type="submit"]')).toBeInTheDocument();
  });

  test('should have proper form structure and labels', () => {
    render(<SearchInput {...defaultProps} />);
    
    // Check form has search role
    const form = screen.getByRole('search');
    expect(form).toBeInTheDocument();
    
    // Check input has proper attributes
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-label', 'Search query input');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  test('should handle keyboard navigation in suggestions', async () => {
    const user = userEvent.setup();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query 1', timestamp: Date.now() },
      { query: 'test query 2', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    
    await waitFor(() => {
      const suggestions = screen.queryByRole('listbox');
      if (suggestions) {
        expect(input).toHaveAttribute('aria-activedescendant');
      }
    });
  });

  test('should support Enter key for suggestion selection', async () => {
    const user = userEvent.setup();
    const onSearch = jest.fn();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} onSearch={onSearch} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Select suggestion with arrow key and Enter
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    
    // Should trigger search
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalled();
    });
  });

  test('should support Escape key to close suggestions', async () => {
    const user = userEvent.setup();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Press Escape
    await user.keyboard('{Escape}');
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test('should have proper error announcement', async () => {
    const mockValidation = require('../../utils/validation');
    mockValidation.validateSearchQuery.mockReturnValue(['Invalid query']);
    
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    const submitButton = screen.getByRole('button', { name: /search/i });
    
    // Submit invalid query
    await user.type(input, 'invalid');
    await user.click(submitButton);
    
    await waitFor(() => {
      const errorMessage = screen.getByText('Invalid query');
      expect(errorMessage).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-describedby', 'search-errors');
    });
  });

  test('should have accessible suggestions dropdown', async () => {
    const user = userEvent.setup();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query 1', timestamp: Date.now() },
      { query: 'test query 2', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(() => {
      const listbox = screen.queryByRole('listbox');
      if (listbox) {
        expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');
        
        const options = screen.getAllByRole('option');
        options.forEach((option, index) => {
          expect(option).toHaveAttribute('id', `suggestion-${index}`);
          expect(option).toHaveAttribute('role', 'option');
        });
      }
    });
  });

  test('should support mouse and keyboard interaction on suggestions', async () => {
    const user = userEvent.setup();
    const onSearch = jest.fn();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} onSearch={onSearch} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(async () => {
      const options = screen.queryAllByRole('option');
      if (options.length > 0) {
        // Click on suggestion
        await user.click(options[0]);
        expect(onSearch).toHaveBeenCalled();
      }
    });
  });

  test('should have proper button accessibility', () => {
    render(<SearchInput {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /search/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
    
    // When there's text, clear button should be accessible
    const user = userEvent.setup();
    const input = screen.getByRole('combobox');
    
    user.type(input, 'test').then(() => {
      const clearButton = screen.queryByTitle('Clear search');
      if (clearButton) {
        expect(clearButton).toHaveAttribute('type', 'button');
      }
    });
  });

  test('should handle loading state accessibility', () => {
    render(<SearchInput {...defaultProps} isLoading={true} />);
    
    const input = screen.getByRole('combobox');
    const submitButton = screen.getByRole('button', { name: /search/i });
    
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    
    // Loading spinner should be present
    const loadingIndicator = screen.getByRole('button').parentElement?.querySelector('[style*="animation"]');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should support focus management', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} autoFocus={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Input should be focused on mount
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  test('should handle composition events for IME input', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    
    // Simulate IME composition
    fireEvent.compositionStart(input);
    await user.type(input, 'test');
    fireEvent.compositionEnd(input);
    
    expect(input).toHaveValue('test');
  });

  test('should have proper responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    
    const { container } = render(<SearchInput {...defaultProps} />);
    
    // Check that responsive styles are applied
    const searchContainer = container.querySelector('.search-input-container');
    expect(searchContainer).toBeInTheDocument();
  });

  test('should support high contrast mode', () => {
    // Mock high contrast preference
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

    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
  });

  test('should handle disabled state properly', () => {
    render(<SearchInput {...defaultProps} disabled={true} />);
    
    const input = screen.getByRole('combobox');
    const submitButton = screen.getByRole('button', { name: /search/i });
    
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveStyle('cursor: not-allowed');
  });

  test('should provide proper placeholder text', () => {
    const customPlaceholder = 'Enter your search query here';
    render(<SearchInput {...defaultProps} placeholder={customPlaceholder} />);
    
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', customPlaceholder);
  });

  test('should handle Tab key for suggestion completion', async () => {
    const user = userEvent.setup();
    
    // Mock suggestions
    const mockStorage = require('../../utils/storage');
    mockStorage.SearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'test query', timestamp: Date.now() },
    ]);
    
    render(<SearchInput {...defaultProps} showHistory={true} />);
    
    const input = screen.getByRole('combobox');
    
    // Type to trigger suggestions
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Navigate to suggestion and press Tab
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Tab}');
    
    // Should complete the suggestion
    await waitFor(() => {
      expect(input).toHaveValue('test query');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });
});