// Web Scraping Service for Agatha

import { createNetworkError, createContentError } from '../utils/errors';
import { isValidUrl, sanitizeInput } from '../utils/validation';
import { DEFAULT_SEARCH_CONFIG } from '../constants';
import type { NetworkError, ContentError } from '../types';

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  description: string;
  domain: string;
  contentType: string;
  timestamp: Date;
  metadata: {
    wordCount: number;
    hasImages: boolean;
    hasVideos: boolean;
    language?: string;
    author?: string;
    publishDate?: Date;
  };
}

export interface ScrapeOptions {
  timeout?: number;
  maxContentLength?: number;
  includeImages?: boolean;
  includeMetadata?: boolean;
  userAgent?: string;
}

export interface SearchSuggestion {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  relevanceHint: number; // 0-1 score based on search engine ranking
}

export class WebScrapingService {
  private static instance: WebScrapingService;
  private corsProxies: string[] = [
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
  ];
  private currentProxyIndex = 0;

  private constructor() {}

  static getInstance(): WebScrapingService {
    if (!WebScrapingService.instance) {
      WebScrapingService.instance = new WebScrapingService();
    }
    return WebScrapingService.instance;
  }

  /**
   * Discover websites based on search query
   */
  async discoverWebsites(query: string, maxResults: number = 10): Promise<SearchSuggestion[]> {
    if (!query || query.trim().length === 0) {
      throw createContentError('Search query cannot be empty', '', 'invalid');
    }

    const sanitizedQuery = sanitizeInput(query);
    
    try {
      // Use multiple search strategies
      const suggestions = await Promise.allSettled([
        this.searchWithDuckDuckGo(sanitizedQuery, maxResults),
        this.searchWithBing(sanitizedQuery, maxResults),
        this.searchWithGoogle(sanitizedQuery, maxResults),
      ]);

      // Combine and deduplicate results
      const allSuggestions: SearchSuggestion[] = [];
      suggestions.forEach(result => {
        if (result.status === 'fulfilled') {
          allSuggestions.push(...result.value);
        }
      });

      return this.deduplicateAndRank(allSuggestions, maxResults);
    } catch (error) {
      throw createNetworkError(
        `Failed to discover websites: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        undefined
      );
    }
  }

  /**
   * Scrape content from a specific URL
   */
  async scrapeContent(url: string, options: ScrapeOptions = {}): Promise<ScrapedContent> {
    if (!isValidUrl(url)) {
      throw createContentError('Invalid URL provided', url, 'invalid');
    }

    const {
      timeout = DEFAULT_SEARCH_CONFIG.timeout,
      maxContentLength = 50000,
      includeImages = false,
      includeMetadata = true,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    } = options;

    try {
      const html = await this.fetchWithCorsProxy(url, { timeout, userAgent });
      const content = this.extractContent(html, url, {
        maxContentLength,
        includeImages,
        includeMetadata,
      });

      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw createContentError(
          `Failed to scrape content: ${error.message}`,
          url,
          this.categorizeError(error)
        );
      }
      throw createContentError('Unknown error occurred while scraping', url, 'invalid');
    }
  }

  /**
   * Batch scrape multiple URLs
   */
  async scrapeMultiple(
    urls: string[],
    options: ScrapeOptions = {}
  ): Promise<Array<ScrapedContent | ContentError>> {
    const results = await Promise.allSettled(
      urls.map(url => this.scrapeContent(url, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return createContentError(
          `Failed to scrape ${urls[index]}: ${result.reason.message}`,
          urls[index],
          'invalid'
        );
      }
    });
  }

  /**
   * Check if URL is accessible
   */
  async checkUrlAccessibility(url: string): Promise<boolean> {
    if (!isValidUrl(url)) {
      return false;
    }

    try {
      const response = await this.fetchWithCorsProxy(url, { timeout: 5000 });
      return response.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Extract main content from HTML
   */
  private extractContent(
    html: string,
    url: string,
    options: { maxContentLength: number; includeImages: boolean; includeMetadata: boolean }
  ): ScrapedContent {
    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract basic information
    const title = this.extractTitle(doc);
    const description = this.extractDescription(doc);
    const content = this.extractMainContent(doc, options.maxContentLength);
    const domain = new URL(url).hostname;

    // Extract metadata if requested
    const metadata = options.includeMetadata ? this.extractMetadata(doc, content) : {
      wordCount: content.split(/\s+/).length,
      hasImages: false,
      hasVideos: false,
    };

    return {
      url,
      title,
      content,
      description,
      domain,
      contentType: 'text/html',
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Extract title from document
   */
  private extractTitle(doc: Document): string {
    // Try multiple selectors for title
    const titleSelectors = [
      'title',
      'h1',
      '[property="og:title"]',
      '[name="twitter:title"]',
      '.title',
      '.headline',
    ];

    for (const selector of titleSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const title = element.getAttribute('content') || element.textContent;
        if (title && title.trim().length > 0) {
          return sanitizeInput(title.trim());
        }
      }
    }

    return 'Untitled';
  }

  /**
   * Extract description from document
   */
  private extractDescription(doc: Document): string {
    // Try multiple selectors for description
    const descSelectors = [
      '[name="description"]',
      '[property="og:description"]',
      '[name="twitter:description"]',
      '.description',
      '.summary',
      'p',
    ];

    for (const selector of descSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const desc = element.getAttribute('content') || element.textContent;
        if (desc && desc.trim().length > 20) {
          return sanitizeInput(desc.trim().substring(0, 300));
        }
      }
    }

    return '';
  }

  /**
   * Extract main content from document
   */
  private extractMainContent(doc: Document, maxLength: number): string {
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 
      '.advertisement', '.ads', '.sidebar', '.menu',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    // Try to find main content area
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.article-content',
      'article',
      '.entry-content',
    ];

    let contentElement: Element | null = null;
    for (const selector of contentSelectors) {
      contentElement = doc.querySelector(selector);
      if (contentElement) break;
    }

    // Fallback to body if no main content found
    if (!contentElement) {
      contentElement = doc.body;
    }

    if (!contentElement) {
      return '';
    }

    // Extract text content
    let content = contentElement.textContent || '';
    content = content.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    return sanitizeInput(content);
  }

  /**
   * Extract metadata from document
   */
  private extractMetadata(doc: Document, content: string) {
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasVideos = doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;

    // Try to extract language
    const language = doc.documentElement.lang || 
                    doc.querySelector('[property="og:locale"]')?.getAttribute('content') ||
                    undefined;

    // Try to extract author
    const authorSelectors = [
      '[name="author"]',
      '[property="article:author"]',
      '.author',
      '.byline',
    ];
    let author: string | undefined;
    for (const selector of authorSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        author = element.getAttribute('content') || element.textContent?.trim();
        if (author) break;
      }
    }

    // Try to extract publish date
    const dateSelectors = [
      '[property="article:published_time"]',
      '[name="publish_date"]',
      'time[datetime]',
      '.publish-date',
      '.date',
    ];
    let publishDate: Date | undefined;
    for (const selector of dateSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const dateStr = element.getAttribute('content') || 
                       element.getAttribute('datetime') || 
                       element.textContent;
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            publishDate = parsed;
            break;
          }
        }
      }
    }

    return {
      wordCount,
      hasImages,
      hasVideos,
      language,
      author,
      publishDate,
    };
  }

  /**
   * Fetch content using CORS proxy
   */
  private async fetchWithCorsProxy(
    url: string,
    options: { timeout: number; userAgent?: string }
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      // Try direct fetch first
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': options.userAgent || 'Mozilla/5.0 (compatible; AgathaBot/1.0)',
          },
        });

        if (response.ok) {
          return await response.text();
        }
      } catch {
        // Fall through to proxy attempts
      }

      // Try CORS proxies
      for (let i = 0; i < this.corsProxies.length; i++) {
        const proxyIndex = (this.currentProxyIndex + i) % this.corsProxies.length;
        const proxy = this.corsProxies[proxyIndex];

        try {
          const proxyUrl = proxy + encodeURIComponent(url);
          const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': options.userAgent || 'Mozilla/5.0 (compatible; AgathaBot/1.0)',
            },
          });

          if (response.ok) {
            const data = await response.text();
            
            // Handle different proxy response formats
            if (proxy.includes('allorigins')) {
              const parsed = JSON.parse(data);
              return parsed.contents || '';
            }
            
            this.currentProxyIndex = proxyIndex; // Remember working proxy
            return data;
          }
        } catch (error) {
          console.warn(`Proxy ${proxy} failed:`, error);
          continue;
        }
      }

      throw new Error('All CORS proxies failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Search using DuckDuckGo (simplified)
   */
  private async searchWithDuckDuckGo(query: string, maxResults: number): Promise<SearchSuggestion[]> {
    // This is a simplified implementation
    // In a real app, you'd use DuckDuckGo's API or scrape their results
    return this.simulateSearchResults(query, maxResults, 'duckduckgo');
  }

  /**
   * Search using Bing (simplified)
   */
  private async searchWithBing(query: string, maxResults: number): Promise<SearchSuggestion[]> {
    // This is a simplified implementation
    // In a real app, you'd use Bing's Search API
    return this.simulateSearchResults(query, maxResults, 'bing');
  }

  /**
   * Search using Google (simplified)
   */
  private async searchWithGoogle(query: string, maxResults: number): Promise<SearchSuggestion[]> {
    // This is a simplified implementation
    // In a real app, you'd use Google's Custom Search API
    return this.simulateSearchResults(query, maxResults, 'google');
  }

  /**
   * Simulate search results for development
   */
  private async simulateSearchResults(
    query: string,
    maxResults: number,
    source: string
  ): Promise<SearchSuggestion[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const domains = [
      'wikipedia.org', 'stackoverflow.com', 'github.com', 'medium.com',
      'reddit.com', 'news.ycombinator.com', 'arxiv.org', 'scholar.google.com',
      'mozilla.org', 'w3.org', 'developer.mozilla.org', 'css-tricks.com'
    ];

    const results: SearchSuggestion[] = [];
    const queryWords = query.toLowerCase().split(' ');

    for (let i = 0; i < Math.min(maxResults, domains.length); i++) {
      const domain = domains[i];
      const relevanceHint = Math.max(0.3, 1 - (i * 0.1)); // Decreasing relevance

      results.push({
        url: `https://${domain}/${queryWords.join('-')}`,
        title: `${query} - ${domain.split('.')[0]}`,
        snippet: `Information about ${query} from ${domain}. This is a simulated search result for development purposes.`,
        domain,
        relevanceHint,
      });
    }

    return results;
  }

  /**
   * Deduplicate and rank search suggestions
   */
  private deduplicateAndRank(suggestions: SearchSuggestion[], maxResults: number): SearchSuggestion[] {
    // Remove duplicates based on URL
    const seen = new Set<string>();
    const unique = suggestions.filter(suggestion => {
      if (seen.has(suggestion.url)) {
        return false;
      }
      seen.add(suggestion.url);
      return true;
    });

    // Sort by relevance hint (higher is better)
    unique.sort((a, b) => b.relevanceHint - a.relevanceHint);

    return unique.slice(0, maxResults);
  }

  /**
   * Categorize error for better error handling
   */
  private categorizeError(error: Error): 'blocked' | 'cors' | 'timeout' | 'invalid' {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout';
    }
    if (message.includes('cors') || message.includes('cross-origin')) {
      return 'cors';
    }
    if (message.includes('blocked') || message.includes('forbidden')) {
      return 'blocked';
    }
    
    return 'invalid';
  }
}