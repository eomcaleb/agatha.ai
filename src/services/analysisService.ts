// Content Analysis Service for Agatha

import { LLMProviderService, type LLMRequest } from './llmProviderService';
import { CacheStorage } from '../utils/storage';
import { createAPIError, createContentError } from '../utils/errors';
import { sanitizeInput } from '../utils/validation';
import type { AnalysisRequest, AnalysisResponse, SearchResult, APIError } from '../types';
import type { ScrapedContent } from './webScrapingService';

export interface ContentAnalysisOptions {
  useCache?: boolean;
  cacheTTL?: number;
  includeReasoning?: boolean;
  maxContentLength?: number;
  temperature?: number;
}

export interface BatchAnalysisProgress {
  completed: number;
  total: number;
  currentUrl?: string;
  errors: number;
}

export interface AnalysisMetrics {
  averageRelevanceScore: number;
  averageConfidenceScore: number;
  totalAnalyzed: number;
  cacheHitRate: number;
  averageResponseTime: number;
}

export class AnalysisService {
  private static instance: AnalysisService;
  private llmProviderService: LLMProviderService;
  private analysisCache: Map<string, { result: AnalysisResponse; timestamp: number }> = new Map();
  private metrics: {
    totalAnalyzed: number;
    totalCacheHits: number;
    totalResponseTime: number;
    relevanceScores: number[];
    confidenceScores: number[];
  } = {
    totalAnalyzed: 0,
    totalCacheHits: 0,
    totalResponseTime: 0,
    relevanceScores: [],
    confidenceScores: [],
  };

  private constructor() {
    this.llmProviderService = LLMProviderService.getInstance();
  }

  static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }

  /**
   * Analyze content relevance for a single piece of content
   */
  async analyzeContent(
    content: ScrapedContent,
    query: string,
    options: ContentAnalysisOptions = {}
  ): Promise<AnalysisResponse> {
    const {
      useCache = true,
      cacheTTL = 3600000, // 1 hour
      includeReasoning = true,
      maxContentLength = 4000,
      temperature = 0.3,
    } = options;

    const startTime = Date.now();

    try {
      // Check cache first
      if (useCache) {
        const cached = this.getCachedAnalysis(content.url, query);
        if (cached) {
          this.metrics.totalCacheHits++;
          return cached;
        }
      }

      // Prepare content for analysis
      const truncatedContent = this.truncateContent(content.content, maxContentLength);
      const analysisPrompt = this.buildAnalysisPrompt(
        query,
        content.title,
        content.description,
        truncatedContent,
        includeReasoning
      );

      // Make LLM request
      const llmRequest: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature,
        maxTokens: includeReasoning ? 800 : 400,
      };

      const llmResponse = await this.llmProviderService.makeRequest(llmRequest);
      const analysisResult = this.parseAnalysisResponse(llmResponse.content);

      // Cache the result
      if (useCache) {
        this.cacheAnalysis(content.url, query, analysisResult, cacheTTL);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(analysisResult, responseTime);

      return analysisResult;

    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error; // Re-throw API errors
      }

      throw createContentError(
        `Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content.url,
        'invalid'
      );
    }
  }

  /**
   * Analyze multiple pieces of content in batch
   */
  async analyzeBatch(
    contents: ScrapedContent[],
    query: string,
    options: ContentAnalysisOptions = {},
    onProgress?: (progress: BatchAnalysisProgress) => void
  ): Promise<Array<{ content: ScrapedContent; analysis: AnalysisResponse | Error }>> {
    const results: Array<{ content: ScrapedContent; analysis: AnalysisResponse | Error }> = [];
    let completed = 0;
    let errors = 0;

    for (const content of contents) {
      try {
        onProgress?.({
          completed,
          total: contents.length,
          currentUrl: content.url,
          errors,
        });

        const analysis = await this.analyzeContent(content, query, options);
        results.push({ content, analysis });
        completed++;

      } catch (error) {
        const analysisError = error instanceof Error ? error : new Error('Unknown analysis error');
        results.push({ content, analysis: analysisError });
        errors++;
        completed++;
      }

      // Add small delay to avoid overwhelming the API
      if (completed < contents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    onProgress?.({
      completed,
      total: contents.length,
      errors,
    });

    return results;
  }

  /**
   * Enhance search results with AI analysis
   */
  async enhanceSearchResults(
    results: SearchResult[],
    query: string,
    options: ContentAnalysisOptions = {}
  ): Promise<SearchResult[]> {
    const enhancedResults: SearchResult[] = [];

    for (const result of results) {
      try {
        // Create mock scraped content from search result
        const mockContent: ScrapedContent = {
          url: result.url,
          title: result.title,
          content: result.description, // Limited content from search result
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

        const analysis = await this.analyzeContent(mockContent, query, options);

        // Update search result with AI analysis
        enhancedResults.push({
          ...result,
          relevanceScore: Math.max(result.relevanceScore, analysis.relevanceScore),
          confidenceScore: analysis.confidenceScore,
          description: analysis.description || result.description,
        });

      } catch (error) {
        // Keep original result if analysis fails
        enhancedResults.push(result);
      }
    }

    // Re-sort by updated relevance scores
    enhancedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return enhancedResults;
  }

  /**
   * Generate content summary
   */
  async generateSummary(
    content: ScrapedContent,
    maxLength: number = 200
  ): Promise<string> {
    try {
      const summaryPrompt = this.buildSummaryPrompt(
        content.title,
        content.content,
        maxLength
      );

      const llmRequest: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of web content.',
          },
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.3,
        maxTokens: Math.ceil(maxLength * 1.5), // Allow some buffer for token estimation
      };

      const response = await this.llmProviderService.makeRequest(llmRequest);
      return response.content.trim();

    } catch (error) {
      // Fallback to truncated original content
      return content.description || content.content.substring(0, maxLength) + '...';
    }
  }

  /**
   * Extract key topics from content
   */
  async extractTopics(
    content: ScrapedContent,
    maxTopics: number = 5
  ): Promise<string[]> {
    try {
      const topicsPrompt = this.buildTopicsPrompt(
        content.title,
        content.content,
        maxTopics
      );

      const llmRequest: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that identifies key topics and themes in web content.',
          },
          {
            role: 'user',
            content: topicsPrompt,
          },
        ],
        temperature: 0.2,
        maxTokens: 200,
      };

      const response = await this.llmProviderService.makeRequest(llmRequest);
      
      // Parse topics from response
      const topics = response.content
        .split('\n')
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(topic => topic.length > 0)
        .slice(0, maxTopics);

      return topics;

    } catch (error) {
      // Fallback to simple keyword extraction
      return this.extractKeywordsFromContent(content.content, maxTopics);
    }
  }

  /**
   * Get analysis metrics
   */
  getMetrics(): AnalysisMetrics {
    const { totalAnalyzed, totalCacheHits, totalResponseTime, relevanceScores, confidenceScores } = this.metrics;

    return {
      averageRelevanceScore: relevanceScores.length > 0 
        ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length 
        : 0,
      averageConfidenceScore: confidenceScores.length > 0
        ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
        : 0,
      totalAnalyzed,
      cacheHitRate: totalAnalyzed > 0 ? totalCacheHits / totalAnalyzed : 0,
      averageResponseTime: totalAnalyzed > 0 ? totalResponseTime / totalAnalyzed : 0,
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAnalyzed: 0,
      totalCacheHits: 0,
      totalResponseTime: 0,
      relevanceScores: [],
      confidenceScores: [],
    };
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(
    query: string,
    title: string,
    description: string,
    content: string,
    includeReasoning: boolean
  ): string {
    const sanitizedQuery = sanitizeInput(query);
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedDescription = sanitizeInput(description);
    const sanitizedContent = sanitizeInput(content);

    return `
Analyze the relevance of this web content to the search query: "${sanitizedQuery}"

Title: ${sanitizedTitle}
Description: ${sanitizedDescription}
Content: ${sanitizedContent}

Please provide your analysis in the following JSON format:
{
  "relevanceScore": <number between 0 and 1>,
  "confidenceScore": <number between 0 and 1>,
  "description": "<brief description of why this content is relevant>",
  ${includeReasoning ? '"reasoning": "<detailed explanation of your analysis>"' : ''}
}

Guidelines:
- relevanceScore: How well the content matches the search query (0 = not relevant, 1 = highly relevant)
- confidenceScore: How confident you are in your relevance assessment (0 = low confidence, 1 = high confidence)
- description: A brief, helpful description of the content's relevance to the query
${includeReasoning ? '- reasoning: Detailed explanation of your scoring and analysis process' : ''}

Respond only with valid JSON.
    `.trim();
  }

  /**
   * Build summary prompt for LLM
   */
  private buildSummaryPrompt(title: string, content: string, maxLength: number): string {
    return `
Please create a concise summary of the following web content in approximately ${maxLength} characters:

Title: ${sanitizeInput(title)}
Content: ${sanitizeInput(content.substring(0, 2000))}

The summary should:
- Capture the main points and key information
- Be informative and well-written
- Stay within the ${maxLength} character limit
- Focus on the most important aspects of the content
    `.trim();
  }

  /**
   * Build topics extraction prompt for LLM
   */
  private buildTopicsPrompt(title: string, content: string, maxTopics: number): string {
    return `
Please identify the ${maxTopics} most important topics or themes from this web content:

Title: ${sanitizeInput(title)}
Content: ${sanitizeInput(content.substring(0, 2000))}

List the topics as bullet points, one per line. Focus on:
- Main subjects and themes
- Key concepts discussed
- Important categories or areas covered

Format your response as a simple list with one topic per line.
    `.trim();
  }

  /**
   * Get system prompt for analysis
   */
  private getSystemPrompt(): string {
    return `
You are an expert content analyst specializing in web content relevance assessment. Your task is to analyze web content and determine how relevant it is to user search queries.

You should consider:
- Direct keyword matches between query and content
- Semantic similarity and related concepts
- Content quality and depth
- Authoritative sources and credible information
- User intent behind the search query

Always respond with valid JSON in the exact format requested.
    `.trim();
  }

  /**
   * Parse analysis response from LLM
   */
  private parseAnalysisResponse(response: string): AnalysisResponse {
    try {
      // Clean up the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      const relevanceScore = Math.max(0, Math.min(1, parseFloat(parsed.relevanceScore) || 0));
      const confidenceScore = Math.max(0, Math.min(1, parseFloat(parsed.confidenceScore) || 0));

      return {
        relevanceScore,
        confidenceScore,
        description: parsed.description || 'No description provided',
        reasoning: parsed.reasoning || '',
      };

    } catch (error) {
      // Fallback analysis if parsing fails
      return {
        relevanceScore: 0.5,
        confidenceScore: 0.3,
        description: 'Analysis failed - using fallback scoring',
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Truncate content to fit within token limits
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at sentence boundaries
    const truncated = content.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.8) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * Get cached analysis result
   */
  private getCachedAnalysis(url: string, query: string): AnalysisResponse | null {
    const cacheKey = this.getCacheKey(url, query);
    const cached = this.analysisCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      return cached.result;
    }

    if (cached) {
      this.analysisCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(url: string, query: string, result: AnalysisResponse, ttl: number): void {
    const cacheKey = this.getCacheKey(url, query);
    this.analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    if (this.analysisCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(url: string, query: string): string {
    return btoa(`${url}:${query}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.analysisCache.forEach((cached, key) => {
      if (now - cached.timestamp > 3600000) { // 1 hour
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.analysisCache.delete(key));
  }

  /**
   * Update analysis metrics
   */
  private updateMetrics(analysis: AnalysisResponse, responseTime: number): void {
    this.metrics.totalAnalyzed++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.relevanceScores.push(analysis.relevanceScore);
    this.metrics.confidenceScores.push(analysis.confidenceScore);

    // Keep only recent scores for rolling average
    if (this.metrics.relevanceScores.length > 100) {
      this.metrics.relevanceScores = this.metrics.relevanceScores.slice(-100);
      this.metrics.confidenceScores = this.metrics.confidenceScores.slice(-100);
    }
  }

  /**
   * Fallback keyword extraction
   */
  private extractKeywordsFromContent(content: string, maxKeywords: number): string[] {
    // Simple keyword extraction as fallback
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }
}