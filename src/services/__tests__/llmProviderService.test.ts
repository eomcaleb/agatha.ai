// Tests for LLM Provider Service

import { LLMProviderService, AnthropicProvider, OpenAIProvider, GeminiProvider, XAIProvider } from '../llmProviderService';
import { ProviderService } from '../providerService';
import { ApiKeyService } from '../apiKeyService';
import type { LLMRequest } from '../llmProviderService';

// Mock dependencies
jest.mock('../providerService');
jest.mock('../apiKeyService');

const mockProviderService = {
  getActiveProviderName: jest.fn(),
  getProvider: jest.fn(),
  getFallbackProvider: jest.fn(),
  getProviders: jest.fn(),
} as jest.Mocked<Partial<ProviderService>>;

const mockApiKeyService = {
  getApiKey: jest.fn(),
  hasApiKey: jest.fn(),
} as jest.Mocked<Partial<ApiKeyService>>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('LLMProviderService', () => {
  let llmProviderService: LLMProviderService;

  beforeEach(() => {
    // Reset singleton instance
    (LLMProviderService as any).instance = undefined;
    
    // Mock service instances
    (ProviderService.getInstance as jest.Mock).mockReturnValue(mockProviderService);
    (ApiKeyService.getInstance as jest.Mock).mockReturnValue(mockApiKeyService);
    
    llmProviderService = LLMProviderService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockProviderService.getActiveProviderName.mockReturnValue('anthropic');
    mockProviderService.getProvider.mockReturnValue({
      name: 'Anthropic',
      models: ['claude-3-5-sonnet-20241022'],
      baseUrl: 'https://api.anthropic.com/v1',
      rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
    });
    mockApiKeyService.getApiKey.mockReturnValue('sk-ant-test123');
    mockApiKeyService.hasApiKey.mockReturnValue(true);
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = LLMProviderService.getInstance();
      const instance2 = LLMProviderService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getProviderInstance', () => {
    it('should create Anthropic provider instance', async () => {
      const instance = await llmProviderService.getProviderInstance('anthropic');
      expect(instance).toBeInstanceOf(AnthropicProvider);
    });

    it('should create OpenAI provider instance', async () => {
      mockProviderService.getProvider.mockReturnValue({
        name: 'OpenAI',
        models: ['gpt-4o'],
        baseUrl: 'https://api.openai.com/v1',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000 },
      });

      const instance = await llmProviderService.getProviderInstance('openai');
      expect(instance).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Gemini provider instance', async () => {
      mockProviderService.getProvider.mockReturnValue({
        name: 'Google Gemini',
        models: ['gemini-1.5-pro'],
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 32000 },
      });

      const instance = await llmProviderService.getProviderInstance('gemini');
      expect(instance).toBeInstanceOf(GeminiProvider);
    });

    it('should create xAI provider instance', async () => {
      mockProviderService.getProvider.mockReturnValue({
        name: 'xAI',
        models: ['grok-beta'],
        baseUrl: 'https://api.x.ai/v1',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
      });

      const instance = await llmProviderService.getProviderInstance('xai');
      expect(instance).toBeInstanceOf(XAIProvider);
    });

    it('should throw error for unknown provider', async () => {
      await expect(llmProviderService.getProviderInstance('unknown')).rejects.toThrow('Unsupported provider');
    });

    it('should throw error when provider not found', async () => {
      mockProviderService.getProvider.mockReturnValue(null);
      await expect(llmProviderService.getProviderInstance('anthropic')).rejects.toThrow('Provider anthropic not found');
    });

    it('should throw error when no API key configured', async () => {
      mockApiKeyService.getApiKey.mockReturnValue(null);
      await expect(llmProviderService.getProviderInstance('anthropic')).rejects.toThrow('No API key configured');
    });

    it('should cache provider instances', async () => {
      const instance1 = await llmProviderService.getProviderInstance('anthropic');
      const instance2 = await llmProviderService.getProviderInstance('anthropic');
      expect(instance1).toBe(instance2);
    });
  });

  describe('makeRequest', () => {
    const testRequest: LLMRequest = {
      messages: [{ role: 'user', content: 'Hello, world!' }],
      maxTokens: 100,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello! How can I help you today?' }],
          usage: { input_tokens: 10, output_tokens: 15 },
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
        }),
      } as Response);
    });

    it('should make successful request to active provider', async () => {
      const response = await llmProviderService.makeRequest(testRequest);

      expect(response.content).toBe('Hello! How can I help you today?');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(15);
      expect(response.usage?.totalTokens).toBe(25);
    });

    it('should make request to specific provider', async () => {
      mockProviderService.getProvider.mockReturnValue({
        name: 'OpenAI',
        models: ['gpt-4o'],
        baseUrl: 'https://api.openai.com/v1',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000 },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OpenAI response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          model: 'gpt-4o',
        }),
      } as Response);

      const response = await llmProviderService.makeRequest(testRequest, 'openai');

      expect(response.content).toBe('OpenAI response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-ant-test123',
          }),
        })
      );
    });

    it('should try fallback provider on failure', async () => {
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Primary provider failed'));

      // Setup fallback provider
      mockProviderService.getFallbackProvider.mockReturnValue({
        name: 'OpenAI',
        models: ['gpt-4o'],
        baseUrl: 'https://api.openai.com/v1',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000 },
      });

      // Second request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Fallback response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          model: 'gpt-4o',
        }),
      } as Response);

      const response = await llmProviderService.makeRequest(testRequest);

      expect(response.content).toBe('Fallback response');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect rate limits', async () => {
      // Make requests to exceed rate limit
      const provider = {
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022'],
        baseUrl: 'https://api.anthropic.com/v1',
        rateLimit: { requestsPerMinute: 1, tokensPerMinute: 40000 }, // Very low limit
      };
      mockProviderService.getProvider.mockReturnValue(provider);

      // First request should succeed
      await llmProviderService.makeRequest(testRequest);

      // Second request should be rate limited
      await expect(llmProviderService.makeRequest(testRequest)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('validateProvider', () => {
    it('should validate provider successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello!' }],
          usage: { input_tokens: 5, output_tokens: 5 },
          model: 'claude-3-5-sonnet-20241022',
        }),
      } as Response);

      const isValid = await llmProviderService.validateProvider('anthropic');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid provider', async () => {
      mockFetch.mockRejectedValue(new Error('Invalid API key'));

      const isValid = await llmProviderService.validateProvider('anthropic');
      expect(isValid).toBe(false);
    });
  });

  describe('isRateLimited', () => {
    it('should return false for provider with no tracking', () => {
      const isLimited = llmProviderService.isRateLimited('anthropic');
      expect(isLimited).toBe(false);
    });

    it('should return true when rate limit exceeded', async () => {
      const provider = {
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022'],
        baseUrl: 'https://api.anthropic.com/v1',
        rateLimit: { requestsPerMinute: 1, tokensPerMinute: 40000 },
      };
      mockProviderService.getProvider.mockReturnValue(provider);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello!' }],
          usage: { input_tokens: 5, output_tokens: 5 },
          model: 'claude-3-5-sonnet-20241022',
        }),
      } as Response);

      // Make one request to track usage
      await llmProviderService.makeRequest({ messages: [{ role: 'user', content: 'test' }] });

      // Should now be rate limited
      const isLimited = llmProviderService.isRateLimited('anthropic');
      expect(isLimited).toBe(true);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return provider status information', async () => {
      mockProviderService.getProviders.mockReturnValue([
        {
          name: 'Anthropic',
          models: ['claude-3-5-sonnet-20241022'],
          baseUrl: 'https://api.anthropic.com/v1',
          rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
        },
        {
          name: 'OpenAI',
          models: ['gpt-4o'],
          baseUrl: 'https://api.openai.com/v1',
          rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000 },
        },
      ]);

      mockApiKeyService.hasApiKey
        .mockReturnValueOnce(true)  // Anthropic has key
        .mockReturnValueOnce(false); // OpenAI doesn't have key

      const providers = await llmProviderService.getAvailableProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toEqual({
        name: 'Anthropic',
        isConfigured: true,
        isRateLimited: false,
        models: ['claude-3-5-sonnet-20241022'],
      });
      expect(providers[1]).toEqual({
        name: 'OpenAI',
        isConfigured: false,
        isRateLimited: false,
        models: ['gpt-4o'],
      });
    });
  });

  describe('clearCache', () => {
    it('should clear provider instance cache', async () => {
      // Create an instance to cache it
      await llmProviderService.getProviderInstance('anthropic');

      // Clear cache
      llmProviderService.clearCache();

      // Getting instance again should create new one
      const instance = await llmProviderService.getProviderInstance('anthropic');
      expect(instance).toBeInstanceOf(AnthropicProvider);
    });
  });

  describe('getUsageStatistics', () => {
    it('should return usage statistics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello!' }],
          usage: { input_tokens: 10, output_tokens: 15 },
          model: 'claude-3-5-sonnet-20241022',
        }),
      } as Response);

      // Make a request to generate usage
      await llmProviderService.makeRequest({ messages: [{ role: 'user', content: 'test' }] });

      const stats = llmProviderService.getUsageStatistics();
      expect(stats).toHaveProperty('anthropic');
      expect(stats.anthropic.requests).toBe(1);
      expect(stats.anthropic.tokens).toBe(25);
    });
  });
});

describe('Provider Classes', () => {
  const mockProvider = {
    name: 'Test Provider',
    models: ['test-model'],
    baseUrl: 'https://api.test.com',
    rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
  };

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider(mockProvider, 'test-key');
      mockFetch.mockClear();
    });

    it('should make request with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Response text' }],
          usage: { input_tokens: 10, output_tokens: 15 },
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
        }),
      } as Response);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
      };

      const response = await provider.makeRequest(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );

      expect(response.content).toBe('Response text');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider(mockProvider, 'test-key');
      mockFetch.mockClear();
    });

    it('should make request with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Response text' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          model: 'gpt-4o',
        }),
      } as Response);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
      };

      const response = await provider.makeRequest(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );

      expect(response.content).toBe('Response text');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('GeminiProvider', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider(mockProvider, 'test-key');
      mockFetch.mockClear();
    });

    it('should make request with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: 'Response text' }] },
            finishReason: 'STOP',
          }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25,
          },
        }),
      } as Response);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
      };

      const response = await provider.makeRequest(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.test.com/models/gemini-1.5-pro:generateContent?key=test-key'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(response.content).toBe('Response text');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('XAIProvider', () => {
    let provider: XAIProvider;

    beforeEach(() => {
      provider = new XAIProvider(mockProvider, 'test-key');
      mockFetch.mockClear();
    });

    it('should make request with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Response text' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          model: 'grok-beta',
        }),
      } as Response);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
      };

      const response = await provider.makeRequest(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );

      expect(response.content).toBe('Response text');
      expect(response.finishReason).toBe('stop');
    });
  });
});