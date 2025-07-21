// Tests for Web Scraping Service

import { WebScrapingService } from '../webScrapingService';
import { createContentError, createNetworkError } from '../../utils/errors';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock DOMParser
global.DOMParser = jest.fn().mockImplementation(() => ({
  parseFromString: jest.fn().mockReturnValue({
    title: 'Test Title',
    body: {
      textContent: 'Test content for the webpage',
    },
    querySelector: jest.fn().mockImplementation((selector) => {
      if (selector === 'title') {
        return { textContent: 'Test Title' };
      }
      if (selector === '[name="description"]') {
        return { getAttribute: () => 'Test description' };
      }
      return null;
    }),
    querySelectorAll: jest.fn().mockReturnValue([]),
    documentElement: { lang: 'en' },
  }),
}));

describe('WebScrapingService', () => {
  let webScrapingService: WebScrapingService;

  beforeEach(() => {
    // Reset singleton instance
    (WebScrapingService as any).instance = undefined;
    webScrapingService = WebScrapingService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><head><title>Test</title></head><body>Test content</body></html>'),
    } as Response);
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = WebScrapingService.getInstance();
      const instance2 = WebScrapingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('discoverWebsites', () => {
    it('should discover websites for valid query', async () => {
      const query = 'artificial intelligence';
      const results = await webScrapingService.discoverWebsites(query, 5);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('snippet');
      expect(results[0]).toHaveProperty('domain');
      expect(results[0]).toHaveProperty('relevanceHint');
    });

    it('should throw error for empty query', async () => {
      await expect(webScrapingService.discoverWebsites('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should limit results to maxResults', async () => {
      const results = await webScrapingService.discoverWebsites('test query', 3);
      expect(results).toHaveLength(3);
    });

    it('should return results sorted by relevance', async () => {
      const results = await webScrapingService.discoverWebsites('test query', 5);
      
      // Check that relevance hints are in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i].relevanceHint).toBeLessThanOrEqual(results[i - 1].relevanceHint);
      }
    });
  });

  describe('scrapeContent', () => {
    it('should scrape content from valid URL', async () => {
      const url = 'https://example.com';
      const mockHtml = `
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <main>
              <h1>Main Heading</h1>
              <p>This is the main content of the page.</p>
            </main>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response);

      const result = await webScrapingService.scrapeContent(url);

      expect(result.url).toBe(url);
      expect(result.title).toBe('Test Title'); // From mocked DOMParser
      expect(result.domain).toBe('example.com');
      expect(result.contentType).toBe('text/html');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.metadata).toHaveProperty('wordCount');
    });

    it('should throw error for invalid URL', async () => {
      await expect(webScrapingService.scrapeContent('invalid-url')).rejects.toThrow('Invalid URL provided');
    });

    it('should handle fetch failures with CORS proxy fallback', async () => {
      const url = 'https://example.com';
      
      // First fetch fails (direct)
      mockFetch
        .mockRejectedValueOnce(new Error('CORS error'))
        // Second fetch succeeds (proxy)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('{"contents": "<html><body>Proxy content</body></html>"}'),
        } as Response);

      const result = await webScrapingService.scrapeContent(url);
      
      expect(result.url).toBe(url);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Direct + proxy
    });

    it('should respect timeout option', async () => {
      const url = 'https://example.com';
      
      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Content</body></html>'),
        } as Response), 1000))
      );

      await expect(
        webScrapingService.scrapeContent(url, { timeout: 100 })
      ).rejects.toThrow();
    });

    it('should limit content length', async () => {
      const url = 'https://example.com';
      const longContent = 'A'.repeat(1000);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(`<html><body>${longContent}</body></html>`),
      } as Response);

      const result = await webScrapingService.scrapeContent(url, { maxContentLength: 100 });
      
      expect(result.content.length).toBeLessThanOrEqual(104); // 100 + '...'
    });
  });

  describe('scrapeMultiple', () => {
    it('should scrape multiple URLs successfully', async () => {
      const urls = ['https://example1.com', 'https://example2.com'];
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Content</body></html>'),
      } as Response);

      const results = await webScrapingService.scrapeMultiple(urls);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('url');
      expect(results[1]).toHaveProperty('url');
    });

    it('should handle mixed success/failure results', async () => {
      const urls = ['https://example1.com', 'invalid-url'];
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Content</body></html>'),
      } as Response);

      const results = await webScrapingService.scrapeMultiple(urls);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('url'); // Success
      expect(results[1]).toHaveProperty('type'); // Error
    });
  });

  describe('checkUrlAccessibility', () => {
    it('should return true for accessible URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>Content</body></html>'),
      } as Response);

      const result = await webScrapingService.checkUrlAccessibility('https://example.com');
      expect(result).toBe(true);
    });

    it('should return false for inaccessible URL', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await webScrapingService.checkUrlAccessibility('https://example.com');
      expect(result).toBe(false);
    });

    it('should return false for invalid URL', async () => {
      const result = await webScrapingService.checkUrlAccessibility('invalid-url');
      expect(result).toBe(false);
    });
  });

  describe('content extraction', () => {
    it('should extract title from multiple sources', () => {
      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector) => {
          if (selector === 'title') {
            return { textContent: 'Page Title' };
          }
          if (selector === 'h1') {
            return { textContent: 'Main Heading' };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
        body: { textContent: 'Body content' },
        documentElement: { lang: 'en' },
      };

      // Access private method for testing
      const service = webScrapingService as any;
      const title = service.extractTitle(mockDoc);
      
      expect(title).toBe('Page Title');
    });

    it('should extract description from meta tags', () => {
      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector) => {
          if (selector === '[name="description"]') {
            return { getAttribute: () => 'Page description' };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
        body: { textContent: 'Body content' },
        documentElement: { lang: 'en' },
      };

      const service = webScrapingService as any;
      const description = service.extractDescription(mockDoc);
      
      expect(description).toBe('Page description');
    });

    it('should extract metadata correctly', () => {
      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector) => {
          if (selector === '[name="author"]') {
            return { getAttribute: () => 'John Doe' };
          }
          if (selector === 'time[datetime]') {
            return { getAttribute: () => '2023-01-01T00:00:00Z' };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockImplementation((selector) => {
          if (selector === 'img') {
            return [{ src: 'image1.jpg' }, { src: 'image2.jpg' }];
          }
          if (selector.includes('video')) {
            return [{ src: 'video.mp4' }];
          }
          return [];
        }),
        documentElement: { lang: 'en' },
      };

      const service = webScrapingService as any;
      const metadata = service.extractMetadata(mockDoc, 'This is test content with multiple words');
      
      expect(metadata.wordCount).toBe(8);
      expect(metadata.hasImages).toBe(true);
      expect(metadata.hasVideos).toBe(true);
      expect(metadata.author).toBe('John Doe');
      expect(metadata.language).toBe('en');
    });
  });

  describe('error handling', () => {
    it('should categorize timeout errors correctly', () => {
      const service = webScrapingService as any;
      const timeoutError = new Error('Request timeout');
      const category = service.categorizeError(timeoutError);
      
      expect(category).toBe('timeout');
    });

    it('should categorize CORS errors correctly', () => {
      const service = webScrapingService as any;
      const corsError = new Error('CORS policy violation');
      const category = service.categorizeError(corsError);
      
      expect(category).toBe('cors');
    });

    it('should categorize blocked errors correctly', () => {
      const service = webScrapingService as any;
      const blockedError = new Error('Access blocked');
      const category = service.categorizeError(blockedError);
      
      expect(category).toBe('blocked');
    });

    it('should default to invalid for unknown errors', () => {
      const service = webScrapingService as any;
      const unknownError = new Error('Unknown error');
      const category = service.categorizeError(unknownError);
      
      expect(category).toBe('invalid');
    });
  });

  describe('deduplication and ranking', () => {
    it('should remove duplicate URLs', () => {
      const suggestions = [
        { url: 'https://example.com', title: 'Test 1', snippet: 'Snippet 1', domain: 'example.com', relevanceHint: 0.9 },
        { url: 'https://example.com', title: 'Test 2', snippet: 'Snippet 2', domain: 'example.com', relevanceHint: 0.8 },
        { url: 'https://other.com', title: 'Test 3', snippet: 'Snippet 3', domain: 'other.com', relevanceHint: 0.7 },
      ];

      const service = webScrapingService as any;
      const result = service.deduplicateAndRank(suggestions, 10);
      
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com');
      expect(result[1].url).toBe('https://other.com');
    });

    it('should sort by relevance hint', () => {
      const suggestions = [
        { url: 'https://low.com', title: 'Low', snippet: 'Low relevance', domain: 'low.com', relevanceHint: 0.3 },
        { url: 'https://high.com', title: 'High', snippet: 'High relevance', domain: 'high.com', relevanceHint: 0.9 },
        { url: 'https://medium.com', title: 'Medium', snippet: 'Medium relevance', domain: 'medium.com', relevanceHint: 0.6 },
      ];

      const service = webScrapingService as any;
      const result = service.deduplicateAndRank(suggestions, 10);
      
      expect(result[0].relevanceHint).toBe(0.9);
      expect(result[1].relevanceHint).toBe(0.6);
      expect(result[2].relevanceHint).toBe(0.3);
    });

    it('should limit results to maxResults', () => {
      const suggestions = Array.from({ length: 10 }, (_, i) => ({
        url: `https://example${i}.com`,
        title: `Test ${i}`,
        snippet: `Snippet ${i}`,
        domain: `example${i}.com`,
        relevanceHint: 1 - (i * 0.1),
      }));

      const service = webScrapingService as any;
      const result = service.deduplicateAndRank(suggestions, 5);
      
      expect(result).toHaveLength(5);
    });
  });
});