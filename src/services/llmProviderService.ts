// LLM Provider Abstraction Layer for Agatha

import { ProviderService } from './providerService';
import { ApiKeyService } from './apiKeyService';
import { createAPIError, createNetworkError } from '../utils/errors';
import type { LLMProvider, AnalysisRequest, AnalysisResponse, APIError } from '../types';

export interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface RateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
}

export abstract class BaseLLMProvider {
  protected provider: LLMProvider;
  protected apiKey: string;

  constructor(provider: LLMProvider, apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  abstract makeRequest(request: LLMRequest): Promise<LLMResponse>;
  abstract getRateLimitInfo(): Promise<RateLimitInfo | null>;
  abstract validateApiKey(): Promise<boolean>;

  protected async handleRequest(
    url: string,
    headers: Record<string, string>,
    body: any,
    timeout: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw createAPIError(
          `HTTP ${response.status}: ${errorText}`,
          this.provider.name,
          response.status,
          response.status === 429
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw createNetworkError('Request timeout', undefined, url);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected parseRateLimitHeaders(headers: Headers): Partial<RateLimitInfo> {
    const requestsRemaining = headers.get('x-ratelimit-remaining-requests');
    const tokensRemaining = headers.get('x-ratelimit-remaining-tokens');
    const resetTime = headers.get('x-ratelimit-reset-requests');

    return {
      requestsRemaining: requestsRemaining ? parseInt(requestsRemaining) : undefined,
      tokensRemaining: tokensRemaining ? parseInt(tokensRemaining) : undefined,
      resetTime: resetTime ? new Date(resetTime) : undefined,
    };
  }
}

export class AnthropicProvider extends BaseLLMProvider {
  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.provider.baseUrl}/messages`;
    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };

    const body = {
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      messages: request.messages,
    };

    const response = await this.handleRequest(url, headers, body);
    const data = await response.json();

    return {
      content: data.content[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
    };
  }

  async getRateLimitInfo(): Promise<RateLimitInfo | null> {
    // Anthropic doesn't provide a direct rate limit endpoint
    // Return null to indicate rate limit info is not available
    return null;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      };
      await this.makeRequest(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class OpenAIProvider extends BaseLLMProvider {
  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.provider.baseUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const body = {
      model: request.model || 'gpt-4o',
      messages: request.messages,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 1,
      stream: request.stream || false,
    };

    const response = await this.handleRequest(url, headers, body);
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  async getRateLimitInfo(): Promise<RateLimitInfo | null> {
    // OpenAI provides rate limit info in response headers
    // This would need to be tracked from previous requests
    return null;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      };
      await this.makeRequest(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class GeminiProvider extends BaseLLMProvider {
  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || 'gemini-1.5-pro';
    const url = `${this.provider.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    const headers = {};

    // Convert messages to Gemini format
    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7,
        topP: request.topP || 1,
      },
    };

    const response = await this.handleRequest(url, headers, body);
    const data = await response.json();

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      } : undefined,
      model: model,
      finishReason: data.candidates?.[0]?.finishReason?.toLowerCase(),
    };
  }

  async getRateLimitInfo(): Promise<RateLimitInfo | null> {
    return null;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      };
      await this.makeRequest(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class XAIProvider extends BaseLLMProvider {
  async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.provider.baseUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const body = {
      model: request.model || 'grok-beta',
      messages: request.messages,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 1,
      stream: request.stream || false,
    };

    const response = await this.handleRequest(url, headers, body);
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  async getRateLimitInfo(): Promise<RateLimitInfo | null> {
    return null;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      };
      await this.makeRequest(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class LLMProviderService {
  private static instance: LLMProviderService;
  private providerService: ProviderService;
  private apiKeyService: ApiKeyService;
  private providerInstances: Map<string, BaseLLMProvider> = new Map();
  private rateLimitTracking: Map<string, { requests: number; tokens: number; resetTime: Date }> = new Map();

  private constructor() {
    this.providerService = ProviderService.getInstance();
    this.apiKeyService = ApiKeyService.getInstance();
  }

  static getInstance(): LLMProviderService {
    if (!LLMProviderService.instance) {
      LLMProviderService.instance = new LLMProviderService();
    }
    return LLMProviderService.instance;
  }

  /**
   * Get provider instance for making requests
   */
  async getProviderInstance(providerName?: string): Promise<BaseLLMProvider> {
    const targetProvider = providerName || this.providerService.getActiveProviderName();
    const provider = this.providerService.getProvider(targetProvider);
    
    if (!provider) {
      throw createAPIError(
        `Provider ${targetProvider} not found`,
        targetProvider,
        undefined,
        false
      );
    }

    const apiKey = this.apiKeyService.getApiKey(targetProvider);
    if (!apiKey) {
      throw createAPIError(
        `No API key configured for ${targetProvider}`,
        targetProvider,
        undefined,
        false
      );
    }

    // Check if we have a cached instance
    const cacheKey = `${targetProvider}_${apiKey.substring(0, 10)}`;
    if (this.providerInstances.has(cacheKey)) {
      return this.providerInstances.get(cacheKey)!;
    }

    // Create new provider instance
    let providerInstance: BaseLLMProvider;
    
    switch (targetProvider.toLowerCase()) {
      case 'anthropic':
        providerInstance = new AnthropicProvider(provider, apiKey);
        break;
      case 'openai':
        providerInstance = new OpenAIProvider(provider, apiKey);
        break;
      case 'gemini':
        providerInstance = new GeminiProvider(provider, apiKey);
        break;
      case 'xai':
        providerInstance = new XAIProvider(provider, apiKey);
        break;
      default:
        throw createAPIError(
          `Unsupported provider: ${targetProvider}`,
          targetProvider,
          undefined,
          false
        );
    }

    this.providerInstances.set(cacheKey, providerInstance);
    return providerInstance;
  }

  /**
   * Make a request to the active or specified provider
   */
  async makeRequest(request: LLMRequest, providerName?: string): Promise<LLMResponse> {
    const targetProvider = providerName || this.providerService.getActiveProviderName();
    
    // Check rate limits
    if (this.isRateLimited(targetProvider)) {
      throw createAPIError(
        `Rate limit exceeded for ${targetProvider}`,
        targetProvider,
        429,
        true
      );
    }

    try {
      const providerInstance = await this.getProviderInstance(targetProvider);
      const response = await providerInstance.makeRequest(request);
      
      // Track usage for rate limiting
      this.trackUsage(targetProvider, response.usage?.totalTokens || 0);
      
      return response;
    } catch (error) {
      // Try fallback provider if available
      if (!providerName && this.shouldTryFallback(error)) {
        const fallbackProvider = this.providerService.getFallbackProvider();
        if (fallbackProvider) {
          console.warn(`Primary provider failed, trying fallback: ${fallbackProvider.name}`);
          return this.makeRequest(request, fallbackProvider.name.toLowerCase());
        }
      }
      
      throw error;
    }
  }

  /**
   * Validate provider API key
   */
  async validateProvider(providerName: string): Promise<boolean> {
    try {
      const providerInstance = await this.getProviderInstance(providerName);
      return await providerInstance.validateApiKey();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get rate limit information for a provider
   */
  async getRateLimitInfo(providerName: string): Promise<RateLimitInfo | null> {
    try {
      const providerInstance = await this.getProviderInstance(providerName);
      return await providerInstance.getRateLimitInfo();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if provider is rate limited
   */
  isRateLimited(providerName: string): boolean {
    const tracking = this.rateLimitTracking.get(providerName);
    if (!tracking) return false;

    const now = new Date();
    if (now > tracking.resetTime) {
      // Reset tracking if time window has passed
      this.rateLimitTracking.delete(providerName);
      return false;
    }

    const provider = this.providerService.getProvider(providerName);
    if (!provider) return false;

    return (
      tracking.requests >= provider.rateLimit.requestsPerMinute ||
      tracking.tokens >= provider.rateLimit.tokensPerMinute
    );
  }

  /**
   * Get available providers with their status
   */
  async getAvailableProviders(): Promise<Array<{
    name: string;
    isConfigured: boolean;
    isRateLimited: boolean;
    models: string[];
  }>> {
    const providers = this.providerService.getProviders();
    const results = [];

    for (const provider of providers) {
      const providerName = provider.name.toLowerCase();
      const isConfigured = this.apiKeyService.hasApiKey(providerName);
      const isRateLimited = this.isRateLimited(providerName);

      results.push({
        name: provider.name,
        isConfigured,
        isRateLimited,
        models: provider.models,
      });
    }

    return results;
  }

  /**
   * Clear provider instance cache
   */
  clearCache(): void {
    this.providerInstances.clear();
  }

  /**
   * Track usage for rate limiting
   */
  private trackUsage(providerName: string, tokens: number): void {
    const now = new Date();
    const resetTime = new Date(now.getTime() + 60000); // 1 minute from now
    
    const existing = this.rateLimitTracking.get(providerName);
    if (existing && now < existing.resetTime) {
      existing.requests += 1;
      existing.tokens += tokens;
    } else {
      this.rateLimitTracking.set(providerName, {
        requests: 1,
        tokens,
        resetTime,
      });
    }
  }

  /**
   * Determine if we should try fallback provider
   */
  private shouldTryFallback(error: unknown): boolean {
    if (error && typeof error === 'object' && 'type' in error) {
      const apiError = error as APIError;
      return (
        apiError.type === 'api' &&
        (apiError.rateLimited || apiError.statusCode === 429 || apiError.statusCode === 503)
      );
    }
    return false;
  }

  /**
   * Get usage statistics
   */
  getUsageStatistics(): Record<string, { requests: number; tokens: number; resetTime: Date }> {
    const stats: Record<string, { requests: number; tokens: number; resetTime: Date }> = {};
    
    this.rateLimitTracking.forEach((tracking, providerName) => {
      stats[providerName] = { ...tracking };
    });
    
    return stats;
  }
}