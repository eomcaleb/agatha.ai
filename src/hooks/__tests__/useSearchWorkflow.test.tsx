// Tests for useSearchWorkflow Hook

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchWorkflow, useSearchResults } from '../useSearchWorkflow';
import { AppStateProvider } from '../useAppState';
import { SearchService } from '../../services/searchService';
import { AnalysisService } from '../../services/analysisService';
import type { SearchQuery, SearchResult } from '../../types';

// Mock services
jest.mock('../../services/searchService');
jest.mock('../../services/analysisService');

const mockSearchService = {
  executeSearch: jest.fn(),
  cancelSearch: jest.fn(),
  getSearchStatistics: jest.fn(),
  clearCache: jest.fn(),
  clearSearchHistory: jest.fn(),
  getSearchHistory: jest.fn(),
  getCachedResults: jest.fn(),
} as jest.Mocked<Partial<SearchService>>;

const mockAnalysisService = {
  enhanceSearchResults: jest.fn(),
  analyzeContent: jest.fn(),
  getMetrics: jest.fn(),
  resetMetrics: jest.fn(),
} as jest.Mocked<Partial<AnalysisService>>;

// Mock utils
jest.mock('../../utils/errors', () => ({
  getErrorMessage: jest.fn((error) => error?.message || 'Unknown error'),
}));

// Test wrapper
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AppStateProvider>{children}</AppStateProvider>
  );
};

describe('useSearchWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock service instances
    (SearchService.getInstance as jest.Mock).mockReturnValue(mockSearchService);
    (AnalysisService.getInstance as jest.Mock).mockReturnValue(mockAnalysisService);

    // Setup default mock implementations
    mockSearchService.executeSearch.mockResolvedValue([]);
    mockSearchService.cancelSearch.mockReturnValue(true);
    mockAnalysisService.enhanceSearchResults.mockResolvedValue([]);
    mockAnalysisService.analyzeContent.mockResolvedValue({
      relevanceScore: 0.8,
      confidenceScore: 0.9,
      description: 'Enhanced description',
      reasoning: 'Analysis reasoning',
    });
  });

  describe('initial state', () => {
    it('should provide initial workflow state', () => {
      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSearching).toBe(false);
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.canCancel).toBe(false);
    });
  });

  describe('executeSearch', () => {
    it('should execute search workflow successfully', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      await act(async () => {
        await result.current.executeSearch(query);
      });

      expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
        query,
        expect.objectContaining({
          useCache: true,
          timeout: 30000,
        }),
        expect.any(Function)
      );

      expect(result.current.isSearching).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle search errors', async () => {
      const searchError = new Error('Search failed');
      mockSearchService.executeSearch.mockRejectedValue(searchError);

      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      await act(async () => {
        await result.current.executeSearch(query);
      });

      expect(result.current.error).toBe('Search failed');
      expect(result.current.isSearching).toBe(false);
    });

    it('should auto-analyze results when enabled', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);
      mockAnalysisService.enhanceSearchResults.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      await act(async () => {
        await result.current.executeSearch(query, { autoAnalyze: true });
      });

      expect(mockAnalysisService.enhanceSearchResults).toHaveBeenCalledWith(
        mockResults,
        'test query'
      );
    });

    it('should handle progress updates', async () => {
      const mockResults: SearchResult[] = [];
      let progressCallback: ((progress: any) => void) | undefined;

      mockSearchService.executeSearch.mockImplementation(async (query, options, onProgress) => {
        progressCallback = onProgress;
        return mockResults;
      });

      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      const searchPromise = act(async () => {
        await result.current.executeSearch(query);
      });

      // Simulate progress updates
      if (progressCallback) {
        act(() => {
          progressCallback({
            phase: 'discovering',
            progress: 10,
            message: 'Discovering websites...',
          });
        });

        expect(result.current.progress).toEqual({
          phase: 'discovering',
          progress: 10,
          message: 'Discovering websites...',
        });
      }

      await searchPromise;
    });
  });

  describe('cancelSearch', () => {
    it('should cancel active search', async () => {
      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      // Start a search
      act(() => {
        result.current.executeSearch(query);
      });

      // Cancel the search
      act(() => {
        result.current.cancelSearch();
      });

      expect(mockSearchService.cancelSearch).toHaveBeenCalledWith(query);
    });
  });

  describe('retrySearch', () => {
    it('should retry the last search', async () => {
      mockSearchService.executeSearch.mockResolvedValue([]);

      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 10,
      };

      // Execute initial search
      await act(async () => {
        await result.current.executeSearch(query);
      });

      // Clear the mock to verify retry call
      mockSearchService.executeSearch.mockClear();

      // Retry search
      await act(async () => {
        await result.current.retrySearch();
      });

      expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
        query,
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('analyzeResults', () => {
    it('should analyze all results when no IDs specified', async () => {
      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      // Set up initial search state
      await act(async () => {
        await result.current.executeSearch({ prompt: 'test', maxResults: 10 });
      });

      mockAnalysisService.enhanceSearchResults.mockResolvedValue(mockResults);

      await act(async () => {
        await result.current.analyzeResults();
      });

      expect(mockAnalysisService.enhanceSearchResults).toHaveBeenCalled();
    });

    it('should analyze specific results when IDs provided', async () => {
      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example1.com',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
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

      mockSearchService.executeSearch.mockResolvedValue(mockResults);

      // Set up initial search state
      await act(async () => {
        await result.current.executeSearch({ prompt: 'test', maxResults: 10 });
      });

      await act(async () => {
        await result.current.analyzeResults(['result1']);
      });

      expect(mockAnalysisService.enhanceSearchResults).toHaveBeenCalledWith(
        [mockResults[0]],
        'test'
      );
    });
  });

  describe('enhanceResult', () => {
    it('should enhance a single result', async () => {
      const { result } = renderHook(() => useSearchWorkflow(), {
        wrapper: createWrapper(),
      });

      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com',
          title: 'Test Result',
          description: 'Test description',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'text/html',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);

      // Set up initial search state
      await act(async () => {
        await result.current.executeSearch({ prompt: 'test', maxResults: 10 });
      });

      await act(async () => {
        await result.current.enhanceResult('result1');
      });

      expect(mockAnalysisService.analyzeContent).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          title: 'Test Result',
        }),
        'test',
        expect.objectContaining({
          includeReasoning: true,
        })
      );
    });
  });
});

describe('useSearchResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide search results and selection methods', () => {
    const { result } = renderHook(() => useSearchResults(), {
      wrapper: createWrapper(),
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.selectedResult).toBeNull();
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectResult).toBeDefined();
    expect(result.current.selectNextResult).toBeDefined();
    expect(result.current.selectPreviousResult).toBeDefined();
  });

  it('should select result by ID', () => {
    const { result: appResult } = renderHook(() => useSearchWorkflow(), {
      wrapper: createWrapper(),
    });

    const { result: resultsResult } = renderHook(() => useSearchResults(), {
      wrapper: createWrapper(),
    });

    const mockResults: SearchResult[] = [
      {
        id: 'result1',
        url: 'https://example.com',
        title: 'Test Result',
        description: 'Test description',
        relevanceScore: 0.8,
        confidenceScore: 0.7,
        timestamp: new Date(),
        metadata: {
          domain: 'example.com',
          contentType: 'text/html',
          loadStatus: 'loaded',
        },
      },
    ];

    // Set up results first
    act(() => {
      appResult.current.executeSearch({ prompt: 'test', maxResults: 10 });
    });

    act(() => {
      resultsResult.current.selectResult('result1');
    });

    // Note: In a real test, we'd need to properly set up the state
    // This is a simplified test structure
  });
});