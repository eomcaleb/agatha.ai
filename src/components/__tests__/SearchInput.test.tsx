// Tests for SearchInput Component

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from '../SearchInput';
import { SearchHistoryStorage } from '../../utils/storage';

// Mock dependencies
jest.mock('../../utils/storage', () => ({
  SearchHistoryStorage: {
    getHistory: jest.fn(),
    addSearch: jest.fn(),
  },
}));

jest.mock('../../utils/validation', () => ({
  validateSearchQuery: jest.fn(() => []),
  sanitizeInput: jest.fn((input: string) => input),
}));

jest.mock('../../constants', () => ({
  ANIMATION_DURATIONS: {
    FADE_IN: 200,
  },
  DEFAULT_SEARCH_CONFIG: {
    maxResults: 10,
  },
}));

const mockSearchHistoryStorage = SearchHistoryStorage as jest.Mocked<typeof SearchHistoryStorage>;

describe('SearchInput', () => {
  const defaultProps = {
    onSearch: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock search history
    mockSearchHistoryStorage.getHistory.mockReturnValue([
      { query: 'artificial intelligence', timestamp: Date.now() - 1000 },
      { query: 'machine learning', timestamp: Date.now() - 2000 },
      { query: 'neural networks', timestamp: Date.now() - 3000 },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should render search input with default placeholder', () => {
      render(<SearchInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search for websites and information...')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(<SearchInput {...defaultProps} placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should render with initial query', () => {
      render(<SearchInput {...defaultProps} initialQuery="test query" />);

      expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
    });

    it('should show clear button when query is present', () => {
      render(<SearchInput {...defaultProps} initialQuery="test" />);

      expect(screen.getByTitle('Clear search')).toBeInTheDocument();
    });

    it('should show loading spinner when loading', () => {
      render(<SearchInput {...defaultProps} isLoading={true} />);

      expect(document.querySelector('[style*="animation: spin"]')).toBeInTheDocument();
    });

    it('should disable input when disabled prop is true', () => {
      render(<SearchInput {...defaultProps} disabled={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      expect(input).toBeDisabled();
    });

    it('should apply custom className', () => {
      render(<SearchInput {...defaultProps} className="custom-search" />);

      expect(document.querySelector('.search-input-container')).toHaveClass('custom-search');
    });
  });

  describe('input handling', () => {
    it('should update query on input change', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should clear input when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} initialQuery="test" />);

      const clearButton = screen.getByTitle('Clear search');
      await user.click(clearButton);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      expect(input).toHaveValue('');
    });

    it('should handle composition events for IME input', () => {
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: 'test' } });
      
      // Should not update during composition
      expect(input).toHaveValue('');
      
      fireEvent.compositionEnd(input, { target: { value: 'test' } });
      expect(input).toHaveValue('test');
    });
  });

  describe('form submission', () => {
    it('should call onSearch when form is submitted', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      const submitButton = screen.getByText('Search');

      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        prompt: 'test query',
        maxResults: 10,
      });
    });

    it('should call onSearch when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        prompt: 'test query',
        maxResults: 10,
      });
    });

    it('should not submit empty query', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const submitButton = screen.getByText('Search');
      await user.click(submitButton);

      expect(defaultProps.onSearch).not.toHaveBeenCalled();
    });

    it('should not submit when loading', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} isLoading={true} initialQuery="test" />);

      const submitButton = screen.getByText('Search');
      await user.click(submitButton);

      expect(defaultProps.onSearch).not.toHaveBeenCalled();
    });

    it('should add search to history after submission', async () => {
      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      expect(mockSearchHistoryStorage.addSearch).toHaveBeenCalledWith('test query');
    });
  });

  describe('suggestions', () => {
    it('should show suggestions on focus', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
        expect(screen.getByText('machine learning')).toBeInTheDocument();
        expect(screen.getByText('neural networks')).toBeInTheDocument();
      });
    });

    it('should filter suggestions based on input', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'artificial');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
        expect(screen.queryByText('machine learning')).not.toBeInTheDocument();
      });
    });

    it('should hide suggestions when showHistory is false', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={false} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.queryByText('artificial intelligence')).not.toBeInTheDocument();
    });

    it('should select suggestion on click', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      await user.click(screen.getByText('artificial intelligence'));

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        prompt: 'artificial intelligence',
        maxResults: 10,
      });
    });

    it('should show suggestion icons', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('🕒')).toBeInTheDocument(); // History icon
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate suggestions with arrow keys', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      // Navigate down
      await user.keyboard('{ArrowDown}');
      
      // First suggestion should be highlighted
      const firstSuggestion = screen.getByText('artificial intelligence').closest('div');
      expect(firstSuggestion).toHaveStyle('background-color: #f8f9fa');

      // Navigate down again
      await user.keyboard('{ArrowDown}');
      
      // Second suggestion should be highlighted
      const secondSuggestion = screen.getByText('machine learning').closest('div');
      expect(secondSuggestion).toHaveStyle('background-color: #f8f9fa');
    });

    it('should select suggestion with Enter key', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        prompt: 'artificial intelligence',
        maxResults: 10,
      });
    });

    it('should complete suggestion with Tab key', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Tab}');

      expect(input).toHaveValue('artificial intelligence');
    });

    it('should hide suggestions with Escape key', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<SearchInput {...defaultProps} showHistory={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByText('artificial intelligence')).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should show validation errors', async () => {
      const { validateSearchQuery } = require('../../utils/validation');
      validateSearchQuery.mockReturnValue(['Query is too short']);

      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'a');
      await user.keyboard('{Enter}');

      expect(screen.getByText('Query is too short')).toBeInTheDocument();
    });

    it('should clear validation errors when typing', async () => {
      const { validateSearchQuery } = require('../../utils/validation');
      validateSearchQuery.mockReturnValue(['Query is too short']);

      const user = userEvent.setup();
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.type(input, 'a');
      await user.keyboard('{Enter}');

      expect(screen.getByText('Query is too short')).toBeInTheDocument();

      validateSearchQuery.mockReturnValue([]);
      await user.type(input, 'b');

      expect(screen.queryByText('Query is too short')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('autoComplete', 'off');
      expect(input).toHaveAttribute('spellCheck', 'false');
    });

    it('should focus input when autoFocus is true', () => {
      render(<SearchInput {...defaultProps} autoFocus={true} />);

      const input = screen.getByPlaceholderText('Search for websites and information...');
      expect(input).toHaveFocus();
    });
  });

  describe('click outside', () => {
    it('should hide suggestions when clicking outside', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <div>
          <SearchInput {...defaultProps} showHistory={true} />
          <div data-testid="outside">Outside element</div>
        </div>
      );

      const input = screen.getByPlaceholderText('Search for websites and information...');
      await user.click(input);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('artificial intelligence')).toBeInTheDocument();
      });

      const outsideElement = screen.getByTestId('outside');
      fireEvent.mouseDown(outsideElement);

      expect(screen.queryByText('artificial intelligence')).not.toBeInTheDocument();
    });
  });
});