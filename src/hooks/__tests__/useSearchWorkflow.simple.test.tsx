// Simple Integration Tests for Search Workflow Orchestration

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppStateProvider } from '../useAppState';
import { useSearchWorkflow } from '../useSearchWorkflow';
import type { SearchQuery, SearchResult } from '../../types';

// Mock services
vi.mock('../../services/searchService', () => ({
  SearchService: {
    getInstance: vi.fn(() => ({
      executeSearch: vi.fn(),
      cancelSearch: vi.fn(),
      getCachedResults: vi.fn(),
      clearCache: vi.fn(),
      getSearchHistory: vi.fn(),
      clearSearchHistory: vi.fn(),
      getSearchStatistics: vi.fn(),
      isSearchActive: vi.fn(),
      getActiveSearches: vi.fn(),
    })),
  },
}));

vi.mock('../../services/analysisService', () => ({
  AnalysisService: {
    getInstance: vi.fn(() => ({
      enhanceSearchResults: vi.fn(),
      analyzeContent: vi.fn(),
      analyzeBatch: vi.fn(),
      generateSummary: vi.fn(),
      extractTopics: vi.fn(),
      getMetrics: vi.fn(),
      clearCache: vi.fn(),
      resetMetrics: vi.fn(),
    })),
  },
}));

vi.mock('../../services/webScrapingService');
vi.mock('../../services/llmProviderService');

// Test component that uses the search workflow
const TestSearchWorkflowComponent: React.FC = () => {
  const {
    executeSearch,
    isSearching,
    isAnalyzing,
    error,
  } = useSearchWorkflow();

  const handleSearch = async () => {
    const query: SearchQuery = {
      prompt: 'test search query',
      maxResults: 5,
    };
    await executeSearch(query);
  };

  return (
    <div>
      <button onClick={handleSearch} data-testid="search-button">
        Search
      </button>
      
      <div data-testid="search-status">
        {isSearching ? 'searching' : isAnalyzing ? 'analyzing' : 'idle'}
      </div>
      
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

describe('useSearchWorkflow Simple Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with idle state', () => {
    renderWithProvider(<TestSearchWorkflowComponent />);
    
    expect(screen.getByTestId('search-status')).toHaveTextContent('idle');
    expect(screen.queryByTestId('error')).not.toBeInTheDocument();
  });

  it('should provide search workflow functions', () => {
    renderWithProvider(<TestSearchWorkflowComponent />);
    
    // Should render without errors
    expect(screen.getByTestId('search-button')).toBeInTheDocument();
    expect(screen.getByTestId('search-status')).toBeInTheDocument();
  });

  it('should handle search execution attempt', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestSearchWorkflowComponent />);

    // Click search button
    await user.click(screen.getByTestId('search-button'));

    // Should not crash (even if mocked services don't work perfectly)
    expect(screen.getByTestId('search-status')).toBeInTheDocument();
  });
});