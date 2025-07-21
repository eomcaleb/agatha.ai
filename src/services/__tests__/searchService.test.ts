// Tests for Search Orchestration Service

import { SearchService } from '../searchService';
import { WebScrapingService } from '../webScrapingService';
import { CacheStorage, SearchHistoryStorage } from '../../utils/storage';
import type { SearchQuery } from '../../types';

// Mock dependencies
jest.mock('../webScrapingService');
jest.mock('../../utils/storage');

const mockWebScrapingService = {
  discoverWebsites: jest.fn(),
  scrapeContent: jest.fn(),
} as jest.Mocked<Partial<WebScrapingService>>;

const mockCacheStorage = CacheStorage as jest.Mocked<typeof CacheStorage>;
const mockSearchHistoryStorage = SearchHistoryStorage as jest.Mocked<typeof SearchHistoryStorage>;

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    // Reset singleton instance
    (SearchService as any).instance = undefined;
    
    // Mock WebScrapingService.getInstance
    (WebScrapingService.getInstance as jest.Mock).mockReturnValue(mockWebScrapingService);
    
    searchService = SearchService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockCacheStorage.getSearchResults.mockReturnValue(null);
    mockWebScrapingService.discoverWebsites.mockResolvedValue([
      {
        url: 'https://example1.com',
        title: 'Example 1',
        snippet: 'First example website',
        domain: 'example1.com',
        relevanceHint: 0.9,
      },
      {
        url: 'https://example2.com',
        title: 'Example 2',
        snippet: 'Second example website',
        domain: 'example2.com',
        relevanceHint: 0.8,
      },
    ]);
    
    mockWebScrapingService.scrapeContent.mockResolvedValue({
      url: 'https://example1.com',
      title: 'Example 1 Title',
      content: 'This is the main content of example 1 website with relevant information.',
      description: 'Example 1 description',
      domain: 'example1.com',
      contentType: 'text/html',
      timestamp: new Date(),
      metadata: {
        wordCount: 12,
        hasImages: false,
        hasVideos: false,
      },
    });
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = SearchService.getInstance();
      const instance2 = SearchService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('executeSearch', () => {
    const validQuery: SearchQuery = {
      prompt: 'artificial intelligence',
      maxResults: 5,
    };

    it('should execute complete search workflow', async () => {
      const results = await searchService.executeSearch(validQuery);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('relevanceScore');
      expect(results[0]).toHaveProperty('confidenceScore');
      expect(results[0].metadata.loadStatus).toBe('loaded');
    });

    it('should return cached results when available', async () => {
      const cachedResults = [
        {
          id: 'cached1',
          url: 'https://cached.com',
          title: 'Cached Result',
          description: 'From cache',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'cached.com',
            contentType: 'text/html',
            loadStatus: 'loaded' as const,
          },
        },
      ];

      mockCacheStorage.getSearchResults.mockReturnValue(cachedResults);

      const results = await searchService.executeSearch(validQuery);

      expect(results).toBe(cachedResults);
      expect(mockWebScrapingService.discoverWebsites).not.toHaveBeenCalled();
    });

    it('should handle search progress callbacks', async () => {
      const progressCallback = jest.fn();

      await searchService.executeSearch(validQuery, {}, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'discovering',
          progress: 10,
          message: 'Discovering relevant websites...',
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'complete',
          progress: 100,
        })
      );
    });

    it('should validate search query', async () => {
      const invalidQuery: SearchQuery = {
        prompt: '',
        maxResults: 5,
      };

      await expect(searchService.executeSearch(invalidQuery)).rejects.toThrow('Invalid search query');
    });

    it('should cache results after successful search', async () => {
      await searchService.executeSearch(validQuery);

      expect(mockCacheStorage.setSearchResults).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        300000 // default TTL
      );
    });

    it('should add search to history', async () => {
      await searchService.executeSearch(validQuery);

      expect(mockSearchHistoryStorage.addSearch).toHaveBeenCalledWith(validQuery.prompt);
    });

    it('should handle scraping errors gracefully', async () => {
      mockWebScrapingService.scrapeContent.mockRejectedValue(new Error('Scraping failed'));

      const results = await searchService.executeSearch(validQuery);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.loadStatus).toBe('error');
      expect(results[0].relevanceScore).toBeLessThan(0.5); // Reduced score for errors
    });

    it('should respect maxConcurrentScrapes option', async () => {
      const manyUrls = Array.from({ length: 10 }, (_, i) => ({
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        snippet: `Snippet ${i}`,
        domain: `example${i}.com`,
        relevanceHint: 0.9 - (i * 0.1),
      }));

      mockWebScrapingService.discoverWebsites.mockResolvedValue(manyUrls);

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockWebScrapingService.scrapeContent.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        concurrentCalls--;
        return {
          url: 'https://example.com',
          title: 'Test',
          content: 'Content',
          description: 'Description',
          domain: 'example.com',
          contentType: 'text/html',
          timestamp: new Date(),
          metadata: { wordCount: 1, hasImages: false, hasVideos: false },
        };
      });

      await searchService.executeSearch(
        { ...validQuery, maxResults: 10 },
        { maxConcurrentScrapes: 3 }
      );

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('cancelSearch', () => {
    it('should cancel active search', async () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      // Start a search that will take some time
      mockWebScrapingService.discoverWebsites.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const searchPromise = searchService.executeSearch(query);
      
      // Cancel the search
      const cancelled = searchService.cancelSearch(query);
      
      expect(cancelled).toBe(true);
      await expect(searchPromise).rejects.toThrow('Search was cancelled');
    });

    it('should return false for non-active search', () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      const cancelled = searchService.cancelSearch(query);
      expect(cancelled).toBe(false);
    });
  });

  describe('isSearchActive', () => {
    it('should return true for active search', async () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      mockWebScrapingService.discoverWebsites.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const searchPromise = searchService.executeSearch(query);
      
      expect(searchService.isSearchActive(query)).toBe(true);
      
      searchService.cancelSearch(query);
      await expect(searchPromise).rejects.toThrow();
    });

    it('should return false for inactive search', () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      expect(searchService.isSearchActive(query)).toBe(false);
    });
  });

  describe('getCachedResults', () => {
    it('should return cached results when available', () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      const cachedResults = [
        {
          id: 'test1',
          url: 'https://test.com',
          title: 'Test',
          description: 'Test description',
          relevanceScore: 0.9,
          confidenceScore: 0.8,
          timestamp: new Date(),
          metadata: {
            domain: 'test.com',
            contentType: 'text/html',
            loadStatus: 'loaded' as const,
          },
        },
      ];

      mockCacheStorage.getSearchResults.mockReturnValue(cachedResults);

      const results = searchService.getCachedResults(query);
      expect(results).toBe(cachedResults);
    });

    it('should return null when no cached results', () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      mockCacheStorage.getSearchResults.mockReturnValue(null);

      const results = searchService.getCachedResults(query);
      expect(results).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear search cache', () => {
      searchService.clearCache();
      expect(mockCacheStorage.clearCache).toHaveBeenCalled();
    });
  });

  describe('getSearchHistory', () => {
    it('should return search history', () => {
      const mockHistory = [
        { query: 'test 1', timestamp: Date.now() },
        { query: 'test 2', timestamp: Date.now() - 1000 },
      ];

      mockSearchHistoryStorage.getHistory.mockReturnValue(mockHistory);

      const history = searchService.getSearchHistory();
      expect(history).toBe(mockHistory);
    });
  });

  describe('clearSearchHistory', () => {
    it('should clear search history', () => {
      searchService.clearSearchHistory();
      expect(mockSearchHistoryStorage.clearHistory).toHaveBeenCalled();
    });
  });

  describe('getActiveSearches', () => {
    it('should return list of active search IDs', async () => {
      const query: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
      };

      mockWebScrapingService.discoverWebsites.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const searchPromise = searchService.executeSearch(query);
      
      const activeSearches = searchService.getActiveSearches();
      expect(activeSearches).toHaveLength(1);
      
      searchService.cancelSearch(query);
      await expect(searchPromise).rejects.toThrow();
    });
  });

  describe('getSearchStatistics', () => {
    it('should return search statistics', () => {
      mockSearchHistoryStorage.getHistory.mockReturnValue([
        { query: 'test 1', timestamp: Date.now() },
        { query: 'test 2', timestamp: Date.now() - 1000 },
      ]);

      const stats = searchService.getSearchStatistics();
      
      expect(stats).toEqual({
        totalSearches: 2,
        cacheHitRate: 0,
        averageResultCount: 0,
        activeSearchCount: 0,
      });
    });
  });

  describe('filtering', () => {
    it('should apply domain filters', async () => {
      const queryWithFilters: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
        filters: {
          domains: ['example1.com'],
        },
      };

      const suggestions = [
        {
          url: 'https://example1.com/page',
          title: 'Example 1',
          snippet: 'From example1',
          domain: 'example1.com',
          relevanceHint: 0.9,
        },
        {
          url: 'https://other.com/page',
          title: 'Other',
          snippet: 'From other domain',
          domain: 'other.com',
          relevanceHint: 0.8,
        },
      ];

      mockWebScrapingService.discoverWebsites.mockResolvedValue(suggestions);

      const results = await searchService.executeSearch(queryWithFilters);

      // Should only scrape from example1.com
      expect(mockWebScrapingService.scrapeContent).toHaveBeenCalledTimes(1);
      expect(mockWebScrapingService.scrapeContent).toHaveBeenCalledWith(
        'https://example1.com/page',
        expect.any(Object)
      );
    });

    it('should apply content type filters', async () => {
      const queryWithFilters: SearchQuery = {
        prompt: 'test query',
        maxResults: 5,
        filters: {
          contentTypes: ['article'],
        },
      };

      const suggestions = [
        {
          url: 'https://example.com/article/test',
          title: 'Article',
          snippet: 'Article content',
          domain: 'example.com',
          relevanceHint: 0.9,
        },
        {
          url: 'https://example.com/other/test',
          title: 'Other',
          snippet: 'Other content',
          domain: 'example.com',
          relevanceHint: 0.8,
        },
      ];

      mockWebScrapingService.discoverWebsites.mockResolvedValue(suggestions);

      const results = await searchService.executeSearch(queryWithFilters);

      // Should only scrape articles
      expect(mockWebScrapingService.scrapeContent).toHaveBeenCalledTimes(1);
      expect(mockWebScrapingService.scrapeContent).toHaveBeenCalledWith(
        'https://example.com/article/test',
        expect.any(Object)
      );
    });
  });
});