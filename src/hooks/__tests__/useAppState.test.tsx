// Tests for useAppState Hook

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppStateProvider, useAppState, useSearchActions, useUIActions, useConfigurationActions } from '../useAppState';
import { PreferencesStorage } from '../../utils/storage';
import type { SearchQuery, SearchResult } from '../../types';

// Mock storage
vi.mock('../../utils/storage', () => ({
  PreferencesStorage: {
    getPreferences: vi.fn(),
    setPreferences: vi.fn(),
  },
}));

vi.mock('../../constants', () => ({
  DEFAULT_USER_PREFERENCES: {
    theme: 'dark',
    maxResults: 10,
    autoAnalyze: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
}));

const mockPreferencesStorage = PreferencesStorage as any;

// Test wrapper
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AppStateProvider>{children}</AppStateProvider>
  );
};

describe('useAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferencesStorage.getPreferences.mockReturnValue(null);
  });

  describe('initial state', () => {
    it('should provide initial state', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.search.status).toBe('idle');
      expect(result.current.state.search.results).toEqual([]);
      expect(result.current.state.ui.viewMode).toBe('cards');
      expect(result.current.state.ui.theme).toBe('dark');
      expect(result.current.state.configuration.activeProvider).toBe('anthropic');
    });

    it('should load saved preferences on mount', () => {
      const savedPreferences = {
        theme: 'light' as const,
        maxResults: 20,
        autoAnalyze: false,
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o',
      };

      mockPreferencesStorage.getPreferences.mockReturnValue(savedPreferences);

      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.configuration.preferences).toEqual(savedPreferences);
      expect(result.current.state.ui.theme).toBe('light');
    });
  });

  describe('search actions', () => {
    it('should set search query', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      act(() => {
        result.current.setSearchQuery(query);
      });

      expect(result.current.state.search.query).toEqual(query);
      expect(result.current.state.search.status).toBe('searching');
      expect(result.current.state.search.error).toBeNull();
    });

    it('should set search status', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchStatus('analyzing');
      });

      expect(result.current.state.search.status).toBe('analyzing');
    });

    it('should set search results', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const results: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      act(() => {
        result.current.setSearchResults(results);
      });

      expect(result.current.state.search.results).toEqual(results);
      expect(result.current.state.search.status).toBe('complete');
      expect(result.current.state.search.error).toBeNull();
    });

    it('should set search error', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchError('Search failed');
      });

      expect(result.current.state.search.error).toBe('Search failed');
      expect(result.current.state.search.status).toBe('error');
    });

    it('should clear search', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      // Set some search data first
      act(() => {
        result.current.setSearchQuery({ prompt: 'test', maxResults: 10 });
        result.current.setSelectedResult('result1');
      });

      // Clear search
      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.state.search.query).toBeNull();
      expect(result.current.state.search.results).toEqual([]);
      expect(result.current.state.search.status).toBe('idle');
      expect(result.current.state.search.error).toBeNull();
      expect(result.current.state.ui.selectedResult).toBeNull();
      expect(result.current.state.ui.cardPosition).toBe(0);
    });
  });

  describe('UI actions', () => {
    it('should set selected result', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedResult('result1');
      });

      expect(result.current.state.ui.selectedResult).toBe('result1');
    });

    it('should set card position', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setCardPosition(5);
      });

      expect(result.current.state.ui.cardPosition).toBe(5);
    });

    it('should set view mode', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setViewMode('iframe');
      });

      expect(result.current.state.ui.viewMode).toBe('iframe');
    });

    it('should set theme', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.state.ui.theme).toBe('light');
    });
  });

  describe('configuration actions', () => {
    it('should set active provider', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setActiveProvider('openai');
      });

      expect(result.current.state.configuration.activeProvider).toBe('openai');
    });

    it('should set active model', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setActiveModel('gpt-4o');
      });

      expect(result.current.state.configuration.activeModel).toBe('gpt-4o');
    });

    it('should update preference', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updatePreference('maxResults', 20);
      });

      expect(result.current.state.configuration.preferences.maxResults).toBe(20);
    });

    it('should update theme preference and UI theme', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updatePreference('theme', 'light');
      });

      expect(result.current.state.configuration.preferences.theme).toBe('light');
      expect(result.current.state.ui.theme).toBe('light');
    });
  });

  describe('computed values', () => {
    it('should compute isSearching correctly', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSearching).toBe(false);

      act(() => {
        result.current.setSearchStatus('searching');
      });

      expect(result.current.isSearching).toBe(true);

      act(() => {
        result.current.setSearchStatus('analyzing');
      });

      expect(result.current.isSearching).toBe(true);

      act(() => {
        result.current.setSearchStatus('complete');
      });

      expect(result.current.isSearching).toBe(false);
    });

    it('should compute hasResults correctly', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasResults).toBe(false);

      const results: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      act(() => {
        result.current.setSearchResults(results);
      });

      expect(result.current.hasResults).toBe(true);
    });

    it('should compute selectedResultData correctly', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const results: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      act(() => {
        result.current.setSearchResults(results);
        result.current.setSelectedResult('result1');
      });

      expect(result.current.selectedResultData).toEqual(results[0]);

      act(() => {
        result.current.setSelectedResult('nonexistent');
      });

      expect(result.current.selectedResultData).toBeNull();
    });

    it('should compute currentResultIndex correctly', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const results: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example1.com',
          title: 'Test Result 1',
          description: 'Test description 1',
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
          title: 'Test Result 2',
          description: 'Test description 2',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'example2.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      act(() => {
        result.current.setSearchResults(results);
        result.current.setSelectedResult('result2');
      });

      expect(result.current.currentResultIndex).toBe(1);

      act(() => {
        result.current.setSelectedResult('nonexistent');
      });

      expect(result.current.currentResultIndex).toBe(-1);
    });
  });

  describe('persistence', () => {
    it('should persist preferences when they change', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updatePreference('maxResults', 25);
      });

      expect(mockPreferencesStorage.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 25 })
      );
    });
  });

  describe('selector hooks', () => {
    it('should provide search state through useSearchActions', () => {
      const { result } = renderHook(() => useSearchActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.setSearchQuery).toBeDefined();
      expect(result.current.setSearchStatus).toBeDefined();
      expect(result.current.setSearchResults).toBeDefined();
      expect(result.current.setSearchError).toBeDefined();
      expect(result.current.clearSearch).toBeDefined();
    });

    it('should provide UI actions through useUIActions', () => {
      const { result } = renderHook(() => useUIActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.setSelectedResult).toBeDefined();
      expect(result.current.setCardPosition).toBeDefined();
      expect(result.current.setViewMode).toBeDefined();
      expect(result.current.setTheme).toBeDefined();
    });

    it('should provide configuration actions through useConfigurationActions', () => {
      const { result } = renderHook(() => useConfigurationActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.setActiveProvider).toBeDefined();
      expect(result.current.setActiveModel).toBeDefined();
      expect(result.current.updatePreference).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when useAppState is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppState());
      }).toThrow('useAppState must be used within an AppStateProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('reducer edge cases', () => {
    it('should handle unknown action types gracefully', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const initialState = result.current.state;

      act(() => {
        // @ts-ignore - Testing unknown action type
        result.current.dispatch({ type: 'UNKNOWN_ACTION' });
      });

      expect(result.current.state).toEqual(initialState);
    });

    it('should handle SET_PREFERENCES action', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      const newPreferences = {
        theme: 'light' as const,
        maxResults: 15,
        autoAnalyze: false,
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o',
      };

      act(() => {
        result.current.dispatch({ type: 'SET_PREFERENCES', payload: newPreferences });
      });

      expect(result.current.state.configuration.preferences).toEqual(newPreferences);
      expect(result.current.state.ui.theme).toBe('light');
    });

    it('should handle RESET_STATE action', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: createWrapper(),
      });

      // Make some changes first
      act(() => {
        result.current.setSearchQuery({ prompt: 'test', maxResults: 10 });
        result.current.setSelectedResult('result1');
        result.current.setTheme('light');
      });

      // Reset state
      act(() => {
        result.current.dispatch({ type: 'RESET_STATE' });
      });

      expect(result.current.state.search.query).toBeNull();
      expect(result.current.state.ui.selectedResult).toBeNull();
      expect(result.current.state.ui.theme).toBe('dark');
    });
  });
});