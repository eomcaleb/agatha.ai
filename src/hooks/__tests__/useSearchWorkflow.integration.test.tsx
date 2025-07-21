// Integration Tests for Search Workflow Orchestration

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppStateProvider } from '../useAppState';
import { useSearchWorkflow } from '../useSearchWorkflow';
import { SearchService } from '../../services/searchService';
import { AnalysisService } from '../../services/analysisService';
import type { SearchQuery, SearchResult } from '../../types';

// Mock services
vi.mock('../../services/searchService');
vi.mock('../../services/analysisService');
vi.mock('../../services/webScrapingService');
vi.mock('../../services/llmProviderService');

const MockedSearchService = SearchService as any;
const MockedAnalysisService = AnalysisService as any;

// Test component that uses the search workflow
const TestSearchWorkflowComponent: React.FC = () => {
  const {
    executeSearch,
    cancelSearch,
    retrySearch,
    analyzeResults,
    enhanceResult,
    isSearching,
    isAnalyzing,
    progress,
    error,
    canCancel,
  } = useSearchWorkflow();

  const handleSearch = async () => {
    const query: SearchQuery = {
      prompt: 'test search query',
      maxResults: 5,
    };
    await executeSearch(query);
  };

  const handleAnalyze = async () => {
    await analyzeResults(['result1', 'result2']);
  };

  const handleEnhance = async () => {
    await enhanceResult('result1');
  };

  return (
    <div>
      <button onClick={handleSearch} data-testid="search-button">
        Search
      </button>
      <button onClick={cancelSearch} data-testid="cancel-button" disabled={!canCancel}>
        Cancel
      </button>
      <button onClick={retrySearch} data-testid="retry-button">
        Retry
      </button>
      <button onClick={handleAnalyze} data-testid="analyze-button">
        Analyze
      </button>
      <button onClick={handleEnhance} data-testid="enhance-button">
        Enhance
      </button>
      
      <div data-testid="search-status">
        {isSearching ? 'searching' : isAnalyzing ? 'analyzing' : 'idle'}
      </div>
      
      {progress && (
        <div data-testid="progress">
          {progress.phase}: {progress.progress}% - {progress.message}
        </div>
      )}
      
      {error && <div data-testid="error">{error}</div>}
    </div>
  );
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <AppStateProvider>
      {component}
    </AppStateProvider>
  );
};

describe('useSearchWorkflow Integration Tests', () => {
  let mockSearchService: any;
  let mockAnalysisService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock instances
    mockSearchService = {
      executeSearch: vi.fn(),
      cancelSearch: vi.fn(),
      getCachedResults: vi.fn(),
      clearCache: vi.fn(),
      getSearchHistory: vi.fn(),
      clearSearchHistory: vi.fn(),
      getSearchStatistics: vi.fn(),
      isSearchActive: vi.fn(),
      getActiveSearches: vi.fn(),
    };

    mockAnalysisService = {
      enhanceSearchResults: vi.fn(),
      analyzeContent: vi.fn(),
      analyzeBatch: vi.fn(),
      generateSummary: vi.fn(),
      extractTopics: vi.fn(),
      getMetrics: vi.fn(),
      clearCache: vi.fn(),
      resetMetrics: vi.fn(),
    };

    // Mock getInstance methods
    MockedSearchService.getInstance = vi.fn().mockReturnValue(mockSearchService);
    MockedAnalysisService.getInstance = vi.fn().mockReturnValue(mockAnalysisService);
  });

  describe('Search Execution Flow', () => {
    it('should execute complete search workflow successfully', async () => {
      const user = userEvent.setup();
      
      // Mock successful search results
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com/1',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
        {
          id: 'result2',
          url: 'https://example.com/2',
          title: 'Test Result 2',
          description: 'Test description 2',
          relevanceScore: 0.7,
          confidenceScore: 0.6,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      // Mock search service to call progress callback and return results
      mockSearchService.executeSearch.mockImplementation(async (query, options, onProgress) => {
        if (onProgress) {
          // Simulate search progress
          onProgress({ phase: 'discovering', progress: 20, message: 'Discovering websites...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'scraping', progress: 60, message: 'Scraping content...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'analyzing', progress: 80, message: 'Analyzing content...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'complete', progress: 100, message: 'Search complete' });
        }
        return mockResults;
      });

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Initial state should be idle
      expect(screen.getByTestId('search-status')).toHaveTextContent('idle');

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should show searching status
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('searching');
      });

      // Should show progress updates
      await waitFor(() => {
        expect(screen.getByTestId('progress')).toBeInTheDocument();
      });

      // Should complete successfully
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      }, { timeout: 5000 });

      // Verify search service was called correctly
      expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test search query',
          maxResults: 5,
        }),
        expect.objectContaining({
          useCache: true,
          timeout: 30000,
          maxConcurrentScrapes: 3,
        }),
        expect.any(Function)
      );
    });

    it('should handle search cancellation', async () => {
      const user = userEvent.setup();
      
      // Mock search service to simulate long-running search
      mockSearchService.executeSearch.mockImplementation(async (query, options, onProgress) => {
        if (onProgress) {
          onProgress({ phase: 'discovering', progress: 20, message: 'Discovering websites...' });
        }
        // Simulate long-running operation
        return new Promise((resolve) => {
          setTimeout(() => resolve([]), 5000);
        });
      });

      mockSearchService.cancelSearch.mockReturnValue(true);

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Wait for search to start
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('searching');
      });

      // Cancel button should be enabled
      expect(screen.getByTestId('cancel-button')).not.toBeDisabled();

      // Cancel search
      await user.click(screen.getByTestId('cancel-button'));

      // Should call cancel on search service
      expect(mockSearchService.cancelSearch).toHaveBeenCalled();
    });

    it('should handle search errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock search service to throw error
      mockSearchService.executeSearch.mockRejectedValue(new Error('Search failed'));

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Search failed');
      });

      // Should return to idle state
      expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
    });
  });

  describe('Analysis Integration', () => {
    it('should auto-analyze results when enabled', async () => {
      const user = userEvent.setup();
      
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com/1',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.5,
          confidenceScore: 0.5,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      const enhancedResults: SearchResult[] = [
        {
          ...mockResults[0],
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          description: 'Enhanced description',
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);
      mockAnalysisService.enhanceSearchResults.mockResolvedValue(enhancedResults);

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should complete search and analysis
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      }, { timeout: 5000 });

      // Should have called analysis service
      expect(mockAnalysisService.enhanceSearchResults).toHaveBeenCalledWith(
        mockResults,
        'test search query'
      );
    });

    it('should analyze specific results', async () => {
      const user = userEvent.setup();
      
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com/1',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.5,
          confidenceScore: 0.5,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
        {
          id: 'result2',
          url: 'https://example.com/2',
          title: 'Test Result 2',
          description: 'Test description 2',
          relevanceScore: 0.4,
          confidenceScore: 0.4,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);
      mockAnalysisService.enhanceSearchResults.mockResolvedValue(mockResults);

      renderWithProvider(<TestSearchWorkflowComponent />);

      // First execute search without auto-analysis
      await user.click(screen.getByTestId('search-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });

      // Then analyze specific results
      await user.click(screen.getByTestId('analyze-button'));

      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });

      // Should have called analysis with filtered results
      expect(mockAnalysisService.enhanceSearchResults).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'result1' }),
          expect.objectContaining({ id: 'result2' }),
        ]),
        'test search query'
      );
    });

    it('should enhance individual results', async () => {
      const user = userEvent.setup();
      
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com/1',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.5,
          confidenceScore: 0.5,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);
      mockAnalysisService.analyzeContent.mockResolvedValue({
        relevanceScore: 0.9,
        confidenceScore: 0.8,
        description: 'Enhanced description',
        reasoning: 'Test reasoning',
      });

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Execute search first
      await user.click(screen.getByTestId('search-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });

      // Enhance specific result
      await user.click(screen.getByTestId('enhance-button'));

      await waitFor(() => {
        expect(mockAnalysisService.analyzeContent).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      const user = userEvent.setup();
      
      const mockResults: SearchResult[] = [
        {
          id: 'result1',
          url: 'https://example.com/1',
          title: 'Test Result 1',
          description: 'Test description 1',
          relevanceScore: 0.5,
          confidenceScore: 0.5,
          timestamp: new Date(),
          metadata: {
            domain: 'example.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(mockResults);
      mockAnalysisService.enhanceSearchResults.mockRejectedValue(new Error('Analysis failed'));

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should show analysis error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Analysis failed: Analysis failed');
      });
    });

    it('should retry failed searches', async () => {
      const user = userEvent.setup();
      
      // First call fails, second succeeds
      mockSearchService.executeSearch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search (will fail)
      await user.click(screen.getByTestId('search-button'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });

      // Retry search
      await user.click(screen.getByTestId('retry-button'));

      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });

      // Should have been called twice
      expect(mockSearchService.executeSearch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Progress Tracking', () => {
    it('should track and display search progress', async () => {
      const user = userEvent.setup();
      
      mockSearchService.executeSearch.mockImplementation(async (query, options, onProgress) => {
        if (onProgress) {
          onProgress({ phase: 'discovering', progress: 25, message: 'Finding websites...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'scraping', progress: 50, message: 'Extracting content...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'analyzing', progress: 75, message: 'Analyzing relevance...' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          onProgress({ phase: 'complete', progress: 100, message: 'Search complete' });
        }
        return [];
      });

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should show initial progress
      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveTextContent('discovering: 25% - Finding websites...');
      });

      // Should update progress
      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveTextContent('scraping: 50% - Extracting content...');
      });

      // Should show final progress
      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveTextContent('complete: 100% - Search complete');
      });

      // Should complete
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cached results when available', async () => {
      const user = userEvent.setup();
      
      const cachedResults: SearchResult[] = [
        {
          id: 'cached1',
          url: 'https://cached.com/1',
          title: 'Cached Result',
          description: 'From cache',
          relevanceScore: 0.8,
          confidenceScore: 0.7,
          timestamp: new Date(),
          metadata: {
            domain: 'cached.com',
            contentType: 'article',
            loadStatus: 'loaded',
          },
        },
      ];

      mockSearchService.executeSearch.mockResolvedValue(cachedResults);

      renderWithProvider(<TestSearchWorkflowComponent />);

      // Start search
      await user.click(screen.getByTestId('search-button'));

      // Should complete quickly (using cache)
      await waitFor(() => {
        expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
      });

      // Should have called search service with cache enabled
      expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ useCache: true }),
        expect.any(Function)
      );
    });
  });
});