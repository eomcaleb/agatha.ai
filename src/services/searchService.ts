// Search Orchestration Service for Agatha

import { WebScrapingService, type SearchSuggestion, type ScrapedContent } from './webScrapingService';
import { CacheStorage, SearchHistoryStorage } from '../utils/storage';
import { validateSearchQuery, sanitizeInput } from '../utils/validation';
import { createNetworkError, createContentError } from '../utils/errors';
import { retryNetworkOperation, withRetry } from '../utils/retry';
import { ErrorHandler } from './errorHandler';
import { DEFAULT_SEARCH_CONFIG } from '../constants';
import type { SearchQuery, SearchResult, NetworkError, ContentError } from '../types';

export interface SearchProgress {
  phase: 'discovering' | 'scraping' | 'analyzing' | 'ranking' | 'complete';
  progress: number; // 0-100
  message: string;
  currentUrl?: string;
}

export interface SearchOptions {
  useCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
  maxConcurrentScrapes?: number;
  includeMetadata?: boolean;
}

export class SearchService {
  private static instance: SearchService;
  private webScrapingService: WebScrapingService;
  private errorHandler: ErrorHandler;
  private activeSearches: Map<string, AbortController> = new Map();
  private searchProgressListeners: Map<string, (progress: SearchProgress) => void> = new Map();

  private constructor() {
    this.webScrapingService = WebScrapingService.getInstance();
    this.errorHandler = new ErrorHandler({
      onError: (error, context) => {
        console.warn(`SearchService error in ${context}:`, error.message);
      }
    });
  }

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Execute a complete search workflow
   */
  async executeSearch(
    query: SearchQuery,
    options: SearchOptions = {},
    onProgress?: (progress: SearchProgress) => void
  ): Promise<SearchResult[]> {
    // Validate search query
    const validationErrors = validateSearchQuery(query);
    if (validationErrors.length > 0) {
      throw createContentError(
        `Invalid search query: ${validationErrors.join(', ')}`,
        '',
        'invalid'
      );
    }

    const searchId = this.generateSearchId(query);
    const abortController = new AbortController();
    this.activeSearches.set(searchId, abortController);

    if (onProgress) {
      this.searchProgressListeners.set(searchId, onProgress);
    }

    const {
      useCache = true,
      cacheTTL = 300000, // 5 minutes
      timeout = DEFAULT_SEARCH_CONFIG.timeout,
      maxConcurrentScrapes = 5,
      includeMetadata = true,
    } = options;

    try {
      // Check cache first
      if (useCache) {
        const cached = CacheStorage.getSearchResults(this.getCacheKey(query));
        if (cached) {
          this.updateProgress(searchId, {
            phase: 'complete',
            progress: 100,
            message: 'Results loaded from cache',
          });
          return cached;
        }
      }

      // Phase 1: Discover websites
      this.updateProgress(searchId, {
        phase: 'discovering',
        progress: 10,
        message: 'Discovering relevant websites...',
      });

      const suggestions = await this.discoverWebsites(query, abortController.signal);

      // Phase 2: Scrape content
      this.updateProgress(searchId, {
        phase: 'scraping',
        progress: 30,
        message: `Scraping content from ${suggestions.length} websites...`,
      });

      const scrapedResults = await this.scrapeWebsites(
        suggestions,
        { timeout, maxConcurrentScrapes, includeMetadata },
        abortController.signal,
        (progress) => this.updateProgress(searchId, {
          phase: 'scraping',
          progress: 30 + (progress * 0.4), // 30-70%
          message: `Scraping content... (${Math.round(progress)}%)`,
          currentUrl: undefined,
        })
      );

      // Phase 3: Process and rank results
      this.updateProgress(searchId, {
        phase: 'ranking',
        progress: 80,
        message: 'Processing and ranking results...',
      });

      const searchResults = await this.processScrapedResults(
        scrapedResults,
        query,
        suggestions
      );

      // Phase 4: Complete
      this.updateProgress(searchId, {
        phase: 'complete',
        progress: 100,
        message: `Found ${searchResults.length} relevant results`,
      });

      // Cache results
      if (useCache && searchResults.length > 0) {
        CacheStorage.setSearchResults(this.getCacheKey(query), searchResults, cacheTTL);
      }

      // Add to search history
      SearchHistoryStorage.addSearch(query.prompt);

      return searchResults;

    } catch (error) {
      if (abortController.signal.aborted) {
        throw createNetworkError('Search was cancelled', undefined, undefined);
      }

      if (error instanceof Error) {
        throw createNetworkError(
          `Search failed: ${error.message}`,
          undefined,
          undefined
        );
      }

      throw createNetworkError('Unknown search error occurred', undefined, undefined);
    } finally {
      this.activeSearches.delete(searchId);
      this.searchProgressListeners.delete(searchId);
    }
  }

  /**
   * Cancel an active search
   */
  cancelSearch(query: SearchQuery): boolean {
    const searchId = this.generateSearchId(query);
    const controller = this.activeSearches.get(searchId);
    
    if (controller) {
      controller.abort();
      this.activeSearches.delete(searchId);
      this.searchProgressListeners.delete(searchId);
      return true;
    }
    
    return false;
  }

  /**
   * Get active searches
   */
  getActiveSearches(): string[] {
    return Array.from(this.activeSearches.keys());
  }

  /**
   * Check if a search is active
   */
  isSearchActive(query: SearchQuery): boolean {
    const searchId = this.generateSearchId(query);
    return this.activeSearches.has(searchId);
  }

  /**
   * Get cached search results
   */
  getCachedResults(query: SearchQuery): SearchResult[] | null {
    return CacheStorage.getSearchResults(this.getCacheKey(query));
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    CacheStorage.clearCache();
  }

  /**
   * Get search history
   */
  getSearchHistory(): Array<{ query: string; timestamp: number }> {
    return SearchHistoryStorage.getHistory();
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    SearchHistoryStorage.clearHistory();
  }

  /**
   * Discover websites based on search query
   */
  private async discoverWebsites(
    query: SearchQuery,
    signal: AbortSignal
  ): Promise<SearchSuggestion[]> {
    if (signal.aborted) {
      throw new Error('Search cancelled');
    }

    try {
      const suggestions = await retryNetworkOperation(async () => {
        if (signal.aborted) {
          throw new Error('Search cancelled');
        }
        return await this.webScrapingService.discoverWebsites(
          query.prompt,
          query.maxResults
        );
      });

      // Apply filters if specified
      if (query.filters) {
        return this.applyFilters(suggestions, query.filters);
      }

      return suggestions;
    } catch (error) {
      const networkError = createNetworkError(
        `Failed to discover websites: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        undefined
      );
      this.errorHandler.handleError(networkError, 'discoverWebsites');
      throw networkError;
    }
  }

  /**
   * Scrape content from discovered websites
   */
  private async scrapeWebsites(
    suggestions: SearchSuggestion[],
    options: { timeout: number; maxConcurrentScrapes: number; includeMetadata: boolean },
    signal: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<Array<{ suggestion: SearchSuggestion; content: ScrapedContent | ContentError }>> {
    const results: Array<{ suggestion: SearchSuggestion; content: ScrapedContent | ContentError }> = [];
    const { maxConcurrentScrapes, timeout, includeMetadata } = options;

    // Process in batches to limit concurrent requests
    for (let i = 0; i < suggestions.length; i += maxConcurrentScrapes) {
      if (signal.aborted) {
        throw new Error('Search cancelled');
      }

      const batch = suggestions.slice(i, i + maxConcurrentScrapes);
      const batchPromises = batch.map(async (suggestion) => {
        try {
          const content = await this.webScrapingService.scrapeContent(
            suggestion.url,
            { timeout, includeMetadata }
          );
          return { suggestion, content };
        } catch (error) {
          const contentError = error instanceof Error 
            ? createContentError(error.message, suggestion.url, 'invalid')
            : createContentError('Unknown scraping error', suggestion.url, 'invalid');
          return { suggestion, content: contentError };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update progress
      const progress = ((i + batch.length) / suggestions.length) * 100;
      onProgress?.(progress);
    }

    return results;
  }

  /**
   * Process scraped results into SearchResult format
   */
  private async processScrapedResults(
    scrapedResults: Array<{ suggestion: SearchSuggestion; content: ScrapedContent | ContentError }>,
    query: SearchQuery,
    originalSuggestions: SearchSuggestion[]
  ): Promise<SearchResult[]> {
    const searchResults: SearchResult[] = [];

    for (const { suggestion, content } of scrapedResults) {
      if ('type' in content) {
        // Handle error case
        searchResults.push({
          id: this.generateResultId(suggestion.url),
          url: suggestion.url,
          title: suggestion.title,
          description: suggestion.snippet,
          relevanceScore: suggestion.relevanceHint * 0.5, // Reduce score for failed scrapes
          confidenceScore: 0.3, // Low confidence for failed scrapes
          timestamp: new Date(),
          metadata: {
            domain: suggestion.domain,
            contentType: 'error',
            loadStatus: 'error',
          },
        });
      } else {
        // Handle successful scrape
        const relevanceScore = this.calculateRelevanceScore(content, query, suggestion);
        const confidenceScore = this.calculateConfidenceScore(content, suggestion);

        searchResults.push({
          id: this.generateResultId(content.url),
          url: content.url,
          title: content.title || suggestion.title,
          description: content.description || suggestion.snippet,
          relevanceScore,
          confidenceScore,
          timestamp: content.timestamp,
          metadata: {
            domain: content.domain,
            contentType: content.contentType,
            loadStatus: 'loaded',
          },
        });
      }
    }

    // Sort by relevance score (highest first)
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return searchResults;
  }

  /**
   * Apply filters to search suggestions
   */
  private applyFilters(
    suggestions: SearchSuggestion[],
    filters: NonNullable<SearchQuery['filters']>
  ): SearchSuggestion[] {
    let filtered = suggestions;

    // Domain filter
    if (filters.domains && filters.domains.length > 0) {
      filtered = filtered.filter(suggestion =>
        filters.domains!.some(domain => suggestion.domain.includes(domain))
      );
    }

    // Content type filter (basic implementation)
    if (filters.contentTypes && filters.contentTypes.length > 0) {
      // This would need more sophisticated implementation based on actual content analysis
      filtered = filtered.filter(suggestion => {
        const url = suggestion.url.toLowerCase();
        return filters.contentTypes!.some(type => {
          switch (type) {
            case 'article':
              return url.includes('article') || url.includes('blog') || url.includes('news');
            case 'documentation':
              return url.includes('docs') || url.includes('documentation') || url.includes('wiki');
            case 'tutorial':
              return url.includes('tutorial') || url.includes('guide') || url.includes('how-to');
            default:
              return true;
          }
        });
      });
    }

    return filtered;
  }

  /**
   * Calculate relevance score based on content and query
   */
  private calculateRelevanceScore(
    content: ScrapedContent,
    query: SearchQuery,
    suggestion: SearchSuggestion
  ): number {
    const queryWords = query.prompt.toLowerCase().split(/\s+/);
    const contentText = (content.title + ' ' + content.description + ' ' + content.content).toLowerCase();
    
    // Count query word matches
    let matches = 0;
    let totalWords = queryWords.length;
    
    queryWords.forEach(word => {
      if (word.length > 2 && contentText.includes(word)) {
        matches++;
      }
    });

    const textRelevance = totalWords > 0 ? matches / totalWords : 0;
    const suggestionRelevance = suggestion.relevanceHint;
    const contentQuality = this.assessContentQuality(content);

    // Weighted combination
    return Math.min(1, (textRelevance * 0.4) + (suggestionRelevance * 0.4) + (contentQuality * 0.2));
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    content: ScrapedContent,
    suggestion: SearchSuggestion
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on content quality
    if (content.title && content.title.length > 10) confidence += 0.1;
    if (content.description && content.description.length > 50) confidence += 0.1;
    if (content.content && content.content.length > 200) confidence += 0.1;
    if (content.metadata.wordCount > 100) confidence += 0.1;

    // Factor in suggestion relevance
    confidence += suggestion.relevanceHint * 0.2;

    return Math.min(1, confidence);
  }

  /**
   * Assess content quality
   */
  private assessContentQuality(content: ScrapedContent): number {
    let quality = 0.5; // Base quality

    // Content length indicators
    if (content.content.length > 500) quality += 0.1;
    if (content.content.length > 1000) quality += 0.1;
    if (content.metadata.wordCount > 200) quality += 0.1;

    // Structure indicators
    if (content.title && content.title.length > 5) quality += 0.1;
    if (content.description && content.description.length > 20) quality += 0.1;

    // Metadata indicators
    if (content.metadata.author) quality += 0.05;
    if (content.metadata.publishDate) quality += 0.05;

    return Math.min(1, quality);
  }

  /**
   * Generate unique search ID
   */
  private generateSearchId(query: SearchQuery): string {
    const queryStr = JSON.stringify({
      prompt: query.prompt,
      maxResults: query.maxResults,
      filters: query.filters,
    });
    return btoa(queryStr).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Generate unique result ID
   */
  private generateResultId(url: string): string {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
  }

  /**
   * Generate cache key for query
   */
  private getCacheKey(query: SearchQuery): string {
    return `search_${this.generateSearchId(query)}`;
  }

  /**
   * Update search progress
   */
  private updateProgress(searchId: string, progress: SearchProgress): void {
    const listener = this.searchProgressListeners.get(searchId);
    if (listener) {
      try {
        listener(progress);
      } catch (error) {
        console.error('Error in search progress listener:', error);
      }
    }
  }

  /**
   * Get search statistics
   */
  getSearchStatistics(): {
    totalSearches: number;
    cacheHitRate: number;
    averageResultCount: number;
    activeSearchCount: number;
  } {
    const history = this.getSearchHistory();
    
    return {
      totalSearches: history.length,
      cacheHitRate: 0, // Would need to track cache hits/misses
      averageResultCount: 0, // Would need to track result counts
      activeSearchCount: this.activeSearches.size,
    };
  }
}