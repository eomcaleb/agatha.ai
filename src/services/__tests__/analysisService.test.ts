// Tests for Content Analysis Service

import { AnalysisService } from '../analysisService';
import { LLMProviderService } from '../llmProviderService';
import type { ScrapedContent } from '../webScrapingService';
import type { SearchResult } from '../../types';

// Mock dependencies
jest.mock('../llmProviderService');

const mockLLMProviderService = {
  makeRequest: jest.fn(),
} as jest.Mocked<Partial<LLMProviderService>>;

describe('AnalysisService', () => {
  let analysisService: AnalysisService;

  beforeEach(() => {
    // Reset singleton instance
    (AnalysisService as any).instance = undefined;
    
    // Mock LLMProviderService.getInstance
    (LLMProviderService.getInstance as jest.Mock).mockReturnValue(mockLLMProviderService);
    
    analysisService = AnalysisService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock response
    mockLLMProviderService.makeRequest.mockResolvedValue({
      content: JSON.stringify({
        relevanceScore: 0.8,
        confidenceScore: 0.9,
        description: 'This content is highly relevant to the search query about artificial intelligence.',
        reasoning: 'The content discusses AI concepts and applications in detail.',
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'claude-3-5-sonnet-20241022',
    });
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = AnalysisService.getInstance();
      const instance2 = AnalysisService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('analyzeContent', () => {
    const mockContent: ScrapedContent = {
      url: 'https://example.com/ai-article',
      title: 'Introduction to Artificial Intelligence',
      content: 'Artificial intelligence (AI) is a branch of computer science that aims to create intelligent machines. This article covers the basics of AI, including machine learning, neural networks, and natural language processing.',
      description: 'A comprehensive guide to AI fundamentals',
      domain: 'example.com',
      contentType: 'text/html',
      timestamp: new Date(),
      metadata: {
        wordCount: 50,
        hasImages: false,
        hasVideos: false,
      },
    };

    it('should analyze content successfully', async () => {
      const query = 'artificial intelligence basics';
      const result = await analysisService.analyzeContent(mockContent, query);

      expect(result.relevanceScore).toBe(0.8);
      expect(result.confidenceScore).toBe(0.9);
      expect(result.description).toBe('This content is highly relevant to the search query about artificial intelligence.');
      expect(result.reasoning).toBe('The content discusses AI concepts and applications in detail.');
    });

    it('should make LLM request with correct parameters', async () => {
      const query = 'machine learning';
      await analysisService.analyzeContent(mockContent, query);

      expect(mockLLMProviderService.makeRequest).toHaveBeenCalledWith({
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('expert content analyst'),
          },
          {
            role: 'user',
            content: expect.stringContaining(query),
          },
        ],
        temperature: 0.3,
        maxTokens: 800,
      });
    });

    it('should handle malformed LLM response gracefully', async () => {
      mockLLMProviderService.makeRequest.mockResolvedValue({
        content: 'Invalid JSON response',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'claude-3-5-sonnet-20241022',
      });

      const result = await analysisService.analyzeContent(mockContent, 'test query');

      expect(result.relevanceScore).toBe(0.5);
      expect(result.confidenceScore).toBe(0.3);
      expect(result.description).toBe('Analysis failed - using fallback scoring');
    });

    it('should truncate long content', async () => {
      const longContent = {
        ...mockContent,
        content: 'A'.repeat(5000), // Very long content
      };

      await analysisService.analyzeContent(longContent, 'test query', { maxContentLength: 1000 });

      const callArgs = mockLLMProviderService.makeRequest.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;
      
      // Content should be truncated
      expect(userMessage.length).toBeLessThan(2000); // Much shorter than original
    });

    it('should use cache when enabled', async () => {
      const query = 'test query';
      
      // First call
      const result1 = await analysisService.analyzeContent(mockContent, query, { useCache: true });
      
      // Second call should use cache
      const result2 = await analysisService.analyzeContent(mockContent, query, { useCache: true });

      expect(result1).toEqual(result2);
      expect(mockLLMProviderService.makeRequest).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should skip cache when disabled', async () => {
      const query = 'test query';
      
      // First call
      await analysisService.analyzeContent(mockContent, query, { useCache: false });
      
      // Second call should not use cache
      await analysisService.analyzeContent(mockContent, query, { useCache: false });

      expect(mockLLMProviderService.makeRequest).toHaveBeenCalledTimes(2); // Called twice
    });

    it('should handle LLM provider errors', async () => {
      mockLLMProviderService.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(analysisService.analyzeContent(mockContent, 'test query')).rejects.toThrow('Failed to analyze content');
    });
  });

  describe('analyzeBatch', () => {
    const mockContents: ScrapedContent[] = [
      {
        url: 'https://example1.com',
        title: 'Article 1',
        content: 'Content about AI',
        description: 'AI article',
        domain: 'example1.com',
        contentType: 'text/html',
        timestamp: new Date(),
        metadata: { wordCount: 10, hasImages: false, hasVideos: false },
      },
      {
        url: 'https://example2.com',
        title: 'Article 2',
        content: 'Content about ML',
        description: 'ML article',
        domain: 'example2.com',
        contentType: 'text/html',
        timestamp: new Date(),
        metadata: { wordCount: 10, hasImages: false, hasVideos: false },
      },
    ];

    it('should analyze multiple contents', async () => {
      const results = await analysisService.analyzeBatch(mockContents, 'artificial intelligence');

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe(mockContents[0]);
      expect(results[0].analysis).toHaveProperty('relevanceScore');
      expect(results[1].content).toBe(mockContents[1]);
      expect(results[1].analysis).toHaveProperty('relevanceScore');
    });

    it('should call progress callback', async () => {
      const progressCallback = jest.fn();

      await analysisService.analyzeBatch(mockContents, 'test query', {}, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith({
        completed: 0,
        total: 2,
        currentUrl: 'https://example1.com',
        errors: 0,
      });

      expect(progressCallback).toHaveBeenCalledWith({
        completed: 2,
        total: 2,
        errors: 0,
      });
    });

    it('should handle individual analysis errors', async () => {
      mockLLMProviderService.makeRequest
        .mockResolvedValueOnce({
          content: JSON.stringify({ relevanceScore: 0.8, confidenceScore: 0.9, description: 'Good' }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'claude-3-5-sonnet-20241022',
        })
        .mockRejectedValueOnce(new Error('Analysis failed'));

      const results = await analysisService.analyzeBatch(mockContents, 'test query');

      expect(results).toHaveLength(2);
      expect(results[0].analysis).toHaveProperty('relevanceScore');
      expect(results[1].analysis).toBeInstanceOf(Error);
    });
  });

  describe('enhanceSearchResults', () => {
    const mockSearchResults: SearchResult[] = [
      {
        id: 'result1',
        url: 'https://example.com/article',
        title: 'AI Article',
        description: 'Article about artificial intelligence',
        relevanceScore: 0.6,
        confidenceScore: 0.5,
        timestamp: new Date(),
        metadata: {
          domain: 'example.com',
          contentType: 'text/html',
          loadStatus: 'loaded',
        },
      },
    ];

    it('should enhance search results with AI analysis', async () => {
      const enhanced = await analysisService.enhanceSearchResults(mockSearchResults, 'artificial intelligence');

      expect(enhanced).toHaveLength(1);
      expect(enhanced[0].relevanceScore).toBe(0.8); // Updated from AI analysis
      expect(enhanced[0].confidenceScore).toBe(0.9); // Updated from AI analysis
    });

    it('should keep original results if analysis fails', async () => {
      mockLLMProviderService.makeRequest.mockRejectedValue(new Error('Analysis failed'));

      const enhanced = await analysisService.enhanceSearchResults(mockSearchResults, 'test query');

      expect(enhanced).toHaveLength(1);
      expect(enhanced[0]).toEqual(mockSearchResults[0]); // Unchanged
    });

    it('should re-sort results by updated relevance scores', async () => {
      const multipleResults: SearchResult[] = [
        { ...mockSearchResults[0], id: 'result1', relevanceScore: 0.6 },
        { ...mockSearchResults[0], id: 'result2', url: 'https://example2.com', relevanceScore: 0.4 },
      ];

      mockLLMProviderService.makeRequest
        .mockResolvedValueOnce({
          content: JSON.stringify({ relevanceScore: 0.5, confidenceScore: 0.8, description: 'Moderate' }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'claude-3-5-sonnet-20241022',
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ relevanceScore: 0.9, confidenceScore: 0.9, description: 'Excellent' }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'claude-3-5-sonnet-20241022',
        });

      const enhanced = await analysisService.enhanceSearchResults(multipleResults, 'test query');

      expect(enhanced[0].id).toBe('result2'); // Should be first due to higher relevance
      expect(enhanced[1].id).toBe('result1');
    });
  });

  describe('generateSummary', () => {
    const mockContent: ScrapedContent = {
      url: 'https://example.com',
      title: 'Long Article',
      content: 'This is a very long article about artificial intelligence and machine learning. It covers many topics including neural networks, deep learning, and natural language processing.',
      description: 'AI article',
      domain: 'example.com',
      contentType: 'text/html',
      timestamp: new Date(),
      metadata: { wordCount: 30, hasImages: false, hasVideos: false },
    };

    it('should generate content summary', async () => {
      mockLLMProviderService.makeRequest.mockResolvedValue({
        content: 'This article provides an overview of AI and ML concepts, covering neural networks and NLP.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'claude-3-5-sonnet-20241022',
      });

      const summary = await analysisService.generateSummary(mockContent, 100);

      expect(summary).toBe('This article provides an overview of AI and ML concepts, covering neural networks and NLP.');
      expect(mockLLMProviderService.makeRequest).toHaveBeenCalledWith({
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('concise, informative summaries'),
          },
          {
            role: 'user',
            content: expect.stringContaining('100 characters'),
          },
        ],
        temperature: 0.3,
        maxTokens: 150,
      });
    });

    it('should fallback to original content if summary fails', async () => {
      mockLLMProviderService.makeRequest.mockRejectedValue(new Error('Summary failed'));

      const summary = await analysisService.generateSummary(mockContent, 50);

      expect(summary).toBe(mockContent.description);
    });
  });

  describe('extractTopics', () => {
    const mockContent: ScrapedContent = {
      url: 'https://example.com',
      title: 'AI Research',
      content: 'Research on artificial intelligence, machine learning, neural networks, and deep learning applications.',
      description: 'AI research',
      domain: 'example.com',
      contentType: 'text/html',
      timestamp: new Date(),
      metadata: { wordCount: 15, hasImages: false, hasVideos: false },
    };

    it('should extract topics from content', async () => {
      mockLLMProviderService.makeRequest.mockResolvedValue({
        content: '- Artificial Intelligence\n- Machine Learning\n- Neural Networks\n- Deep Learning',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'claude-3-5-sonnet-20241022',
      });

      const topics = await analysisService.extractTopics(mockContent, 4);

      expect(topics).toEqual([
        'Artificial Intelligence',
        'Machine Learning',
        'Neural Networks',
        'Deep Learning',
      ]);
    });

    it('should fallback to keyword extraction if topic extraction fails', async () => {
      mockLLMProviderService.makeRequest.mockRejectedValue(new Error('Topic extraction failed'));

      const topics = await analysisService.extractTopics(mockContent, 3);

      expect(topics).toBeInstanceOf(Array);
      expect(topics.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getMetrics', () => {
    it('should return analysis metrics', async () => {
      const mockContent: ScrapedContent = {
        url: 'https://example.com',
        title: 'Test',
        content: 'Test content',
        description: 'Test',
        domain: 'example.com',
        contentType: 'text/html',
        timestamp: new Date(),
        metadata: { wordCount: 2, hasImages: false, hasVideos: false },
      };

      // Perform some analyses to generate metrics
      await analysisService.analyzeContent(mockContent, 'test query 1');
      await analysisService.analyzeContent(mockContent, 'test query 2');

      const metrics = analysisService.getMetrics();

      expect(metrics.totalAnalyzed).toBe(2);
      expect(metrics.averageRelevanceScore).toBe(0.8);
      expect(metrics.averageConfidenceScore).toBe(0.9);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should return zero metrics when no analyses performed', () => {
      const metrics = analysisService.getMetrics();

      expect(metrics.totalAnalyzed).toBe(0);
      expect(metrics.averageRelevanceScore).toBe(0);
      expect(metrics.averageConfidenceScore).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear analysis cache', async () => {
      const mockContent: ScrapedContent = {
        url: 'https://example.com',
        title: 'Test',
        content: 'Test content',
        description: 'Test',
        domain: 'example.com',
        contentType: 'text/html',
        timestamp: new Date(),
        metadata: { wordCount: 2, hasImages: false, hasVideos: false },
      };

      // Analyze content to populate cache
      await analysisService.analyzeContent(mockContent, 'test query', { useCache: true });

      // Clear cache
      analysisService.clearCache();

      // Next analysis should not use cache
      await analysisService.analyzeContent(mockContent, 'test query', { useCache: true });

      expect(mockLLMProviderService.makeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetMetrics', () => {
    it('should reset analysis metrics', async () => {
      const mockContent: ScrapedContent = {
        url: 'https://example.com',
        title: 'Test',
        content: 'Test content',
        description: 'Test',
        domain: 'example.com',
        contentType: 'text/html',
        timestamp: new Date(),
        metadata: { wordCount: 2, hasImages: false, hasVideos: false },
      };

      // Generate some metrics
      await analysisService.analyzeContent(mockContent, 'test query');

      // Reset metrics
      analysisService.resetMetrics();

      const metrics = analysisService.getMetrics();
      expect(metrics.totalAnalyzed).toBe(0);
      expect(metrics.averageRelevanceScore).toBe(0);
      expect(metrics.averageConfidenceScore).toBe(0);
    });
  });
});