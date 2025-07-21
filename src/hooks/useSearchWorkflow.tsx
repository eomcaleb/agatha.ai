// Search Workflow Orchestration Hook for Agatha

import { useCallback, useRef, useEffect } from 'react';
import { SearchService, type SearchProgress } from '../services/searchService';
import { AnalysisService } from '../services/analysisService';
import { useAppState } from './useAppState';
import { getErrorMessage } from '../utils/errors';
import type { SearchQuery, SearchResult } from '../types';

export interface SearchWorkflowOptions {
  autoAnalyze?: boolean;
  useCache?: boolean;
  maxConcurrentAnalysis?: number;
  timeout?: number;
}

export interface SearchWorkflowState {
  isSearching: boolean;
  isAnalyzing: boolean;
  progress: SearchProgress | null;
  error: string | null;
  canCancel: boolean;
}

export interface SearchWorkflowActions {
  executeSearch: (query: SearchQuery, options?: SearchWorkflowOptions) => Promise<void>;
  cancelSearch: () => void;
  retrySearch: () => void;
  analyzeResults: (resultIds?: string[]) => Promise<void>;
  enhanceResult: (resultId: string) => Promise<void>;
}

export const useSearchWorkflow = (): SearchWorkflowState & SearchWorkflowActions => {
  const {
    state,
    setSearchQuery,
    setSearchStatus,
    setSearchResults,
    setSearchError,
    isSearching,
  } = useAppState();

  const searchService = useRef(SearchService.getInstance());
  const analysisService = useRef(AnalysisService.getInstance());
  const currentSearchRef = useRef<SearchQuery | null>(null);
  const progressRef = useRef<SearchProgress | null>(null);

  // Search workflow state
  const isAnalyzing = state.search.status === 'analyzing';
  const progress = progressRef.current;
  const error = state.search.error;
  const canCancel = isSearching || isAnalyzing;

  // Execute complete search workflow
  const executeSearch = useCallback(async (
    query: SearchQuery,
    options: SearchWorkflowOptions = {}
  ) => {
    const {
      autoAnalyze = state.configuration.preferences.autoAnalyze,
      useCache = true,
      maxConcurrentAnalysis = 3,
      timeout = 30000,
    } = options;

    try {
      // Store current search for potential retry
      currentSearchRef.current = query;

      // Clear previous errors
      setSearchError(null);
      
      // Set search query and status
      setSearchQuery(query);
      setSearchStatus('searching');

      // Progress callback
      const onProgress = (searchProgress: SearchProgress) => {
        progressRef.current = searchProgress;
        
        // Update status based on progress phase
        switch (searchProgress.phase) {
          case 'discovering':
          case 'scraping':
            setSearchStatus('searching');
            break;
          case 'analyzing':
          case 'ranking':
            setSearchStatus('analyzing');
            break;
          case 'complete':
            setSearchStatus('complete');
            break;
        }
      };

      // Execute search
      const results = await searchService.current.executeSearch(
        query,
        { useCache, timeout, maxConcurrentScrapes: maxConcurrentAnalysis },
        onProgress
      );

      // Set initial results
      setSearchResults(results);

      // Auto-analyze if enabled and we have results
      if (autoAnalyze && results.length > 0) {
        await analyzeResults(results.map(r => r.id));
      } else {
        setSearchStatus('complete');
      }

      // Clear progress
      progressRef.current = null;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setSearchError(errorMessage);
      setSearchStatus('error');
      progressRef.current = null;
    }
  }, [
    state.configuration.preferences.autoAnalyze,
    setSearchQuery,
    setSearchStatus,
    setSearchResults,
    setSearchError,
  ]);

  // Cancel current search
  const cancelSearch = useCallback(() => {
    if (currentSearchRef.current) {
      const cancelled = searchService.current.cancelSearch(currentSearchRef.current);
      if (cancelled) {
        setSearchStatus('idle');
        setSearchError('Search cancelled');
        progressRef.current = null;
      }
    }
  }, [setSearchStatus, setSearchError]);

  // Retry last search
  const retrySearch = useCallback(async () => {
    if (currentSearchRef.current) {
      await executeSearch(currentSearchRef.current);
    }
  }, [executeSearch]);

  // Analyze specific results or all results
  const analyzeResults = useCallback(async (resultIds?: string[]) => {
    if (!state.search.query || state.search.results.length === 0) {
      return;
    }

    try {
      setSearchStatus('analyzing');
      setSearchError(null);

      // Determine which results to analyze
      const resultsToAnalyze = resultIds
        ? state.search.results.filter(result => resultIds.includes(result.id))
        : state.search.results;

      if (resultsToAnalyze.length === 0) {
        setSearchStatus('complete');
        return;
      }

      // Enhance results with AI analysis
      const enhancedResults = await analysisService.current.enhanceSearchResults(
        resultsToAnalyze,
        state.search.query.prompt
      );

      // Update results with enhanced data
      const updatedResults = state.search.results.map(result => {
        const enhanced = enhancedResults.find(e => e.id === result.id);
        return enhanced || result;
      });

      // Sort by updated relevance scores
      updatedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      setSearchResults(updatedResults);
      setSearchStatus('complete');

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setSearchError(`Analysis failed: ${errorMessage}`);
      setSearchStatus('error');
    }
  }, [
    state.search.query,
    state.search.results,
    setSearchStatus,
    setSearchError,
    setSearchResults,
  ]);

  // Enhance a single result with detailed analysis
  const enhanceResult = useCallback(async (resultId: string) => {
    const result = state.search.results.find(r => r.id === resultId);
    if (!result || !state.search.query) {
      return;
    }

    try {
      // Create mock scraped content from search result
      const mockContent = {
        url: result.url,
        title: result.title,
        content: result.description,
        description: result.description,
        domain: result.metadata.domain,
        contentType: result.metadata.contentType,
        timestamp: result.timestamp,
        metadata: {
          wordCount: result.description.split(' ').length,
          hasImages: false,
          hasVideos: false,
        },
      };

      // Analyze the content
      const analysis = await analysisService.current.analyzeContent(
        mockContent,
        state.search.query.prompt,
        { includeReasoning: true }
      );

      // Update the specific result
      const updatedResults = state.search.results.map(r => {
        if (r.id === resultId) {
          return {
            ...r,
            relevanceScore: Math.max(r.relevanceScore, analysis.relevanceScore),
            confidenceScore: analysis.confidenceScore,
            description: analysis.description || r.description,
          };
        }
        return r;
      });

      // Re-sort results
      updatedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      setSearchResults(updatedResults);

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setSearchError(`Failed to enhance result: ${errorMessage}`);
    }
  }, [
    state.search.results,
    state.search.query,
    setSearchResults,
    setSearchError,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSearchRef.current) {
        searchService.current.cancelSearch(currentSearchRef.current);
      }
    };
  }, []);

  return {
    // State
    isSearching,
    isAnalyzing,
    progress,
    error,
    canCancel,
    
    // Actions
    executeSearch,
    cancelSearch,
    retrySearch,
    analyzeResults,
    enhanceResult,
  };
};

// Hook for search statistics and metrics
export const useSearchMetrics = () => {
  const searchService = useRef(SearchService.getInstance());
  const analysisService = useRef(AnalysisService.getInstance());

  const getSearchStatistics = useCallback(() => {
    return searchService.current.getSearchStatistics();
  }, []);

  const getAnalysisMetrics = useCallback(() => {
    return analysisService.current.getMetrics();
  }, []);

  const clearSearchCache = useCallback(() => {
    searchService.current.clearCache();
  }, []);

  const clearSearchHistory = useCallback(() => {
    searchService.current.clearSearchHistory();
  }, []);

  const resetAnalysisMetrics = useCallback(() => {
    analysisService.current.resetMetrics();
  }, []);

  return {
    getSearchStatistics,
    getAnalysisMetrics,
    clearSearchCache,
    clearSearchHistory,
    resetAnalysisMetrics,
  };
};

// Hook for managing search history and suggestions
export const useSearchHistory = () => {
  const searchService = useRef(SearchService.getInstance());

  const getSearchHistory = useCallback(() => {
    return searchService.current.getSearchHistory();
  }, []);

  const clearSearchHistory = useCallback(() => {
    searchService.current.clearSearchHistory();
  }, []);

  const getCachedResults = useCallback((query: SearchQuery) => {
    return searchService.current.getCachedResults(query);
  }, []);

  return {
    getSearchHistory,
    clearSearchHistory,
    getCachedResults,
  };
};

// Hook for search result management
export const useSearchResults = () => {
  const { state, setSelectedResult, setCardPosition } = useAppState();

  const selectResult = useCallback((resultId: string) => {
    const index = state.search.results.findIndex(r => r.id === resultId);
    if (index !== -1) {
      setSelectedResult(resultId);
      setCardPosition(index);
    }
  }, [state.search.results, setSelectedResult, setCardPosition]);

  const selectNextResult = useCallback(() => {
    const currentIndex = state.ui.selectedResult
      ? state.search.results.findIndex(r => r.id === state.ui.selectedResult)
      : -1;
    
    const nextIndex = currentIndex < state.search.results.length - 1 ? currentIndex + 1 : 0;
    const nextResult = state.search.results[nextIndex];
    
    if (nextResult) {
      selectResult(nextResult.id);
    }
  }, [state.ui.selectedResult, state.search.results, selectResult]);

  const selectPreviousResult = useCallback(() => {
    const currentIndex = state.ui.selectedResult
      ? state.search.results.findIndex(r => r.id === state.ui.selectedResult)
      : -1;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : state.search.results.length - 1;
    const prevResult = state.search.results[prevIndex];
    
    if (prevResult) {
      selectResult(prevResult.id);
    }
  }, [state.ui.selectedResult, state.search.results, selectResult]);

  const getResultByIndex = useCallback((index: number): SearchResult | null => {
    return state.search.results[index] || null;
  }, [state.search.results]);

  const getResultById = useCallback((id: string): SearchResult | null => {
    return state.search.results.find(r => r.id === id) || null;
  }, [state.search.results]);

  const getSelectedResult = useCallback((): SearchResult | null => {
    return state.ui.selectedResult
      ? getResultById(state.ui.selectedResult)
      : null;
  }, [state.ui.selectedResult, getResultById]);

  return {
    results: state.search.results,
    selectedResult: getSelectedResult(),
    selectedIndex: state.ui.selectedResult
      ? state.search.results.findIndex(r => r.id === state.ui.selectedResult)
      : -1,
    
    selectResult,
    selectNextResult,
    selectPreviousResult,
    getResultByIndex,
    getResultById,
    getSelectedResult,
  };
};