// Tests for Provider Configuration Service

import { ProviderService } from '../providerService';
import { ApiKeyService } from '../apiKeyService';
import { DEFAULT_PROVIDERS } from '../../constants';

// Mock the ApiKeyService
jest.mock('../apiKeyService');
const mockApiKeyService = {
  getApiKey: jest.fn(),
  hasApiKey: jest.fn(),
  setApiKey: jest.fn(),
  removeApiKey: jest.fn(),
} as jest.Mocked<Partial<ApiKeyService>>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('ProviderService', () => {
  let providerService: ProviderService;

  beforeEach(() => {
    // Reset singleton instance
    (ProviderService as any).instance = undefined;
    
    // Mock ApiKeyService.getInstance
    (ApiKeyService.getInstance as jest.Mock).mockReturnValue(mockApiKeyService);
    
    // Clear all mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockApiKeyService.hasApiKey.mockReturnValue(false);
    mockApiKeyService.getApiKey.mockReturnValue(null);
    
    providerService = ProviderService.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ProviderService.getInstance();
      const instance2 = ProviderService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getProviders', () => {
    it('should return all default providers', () => {
      const providers = providerService.getProviders();
      
      expect(providers).toHaveLength(Object.keys(DEFAULT_PROVIDERS).length);
      expect(providers.map(p => p.name.toLowerCase())).toEqual(
        expect.arrayContaining(['anthropic', 'openai', 'google gemini', 'xai'])
      );
    });

    it('should include API keys when available', () => {
      mockApiKeyService.getApiKey.mockImplementation((provider) => 
        provider === 'anthropic' ? 'sk-ant-test123' : null
      );

      const providers = providerService.getProviders();
      const anthropicProvider = providers.find(p => p.name === 'Anthropic');
      
      expect(anthropicProvider?.apiKey).toBe('sk-ant-test123');
    });
  });

  describe('getProvider', () => {
    it('should return specific provider by name', () => {
      const provider = providerService.getProvider('anthropic');
      
      expect(provider).toBeTruthy();
      expect(provider?.name).toBe('Anthropic');
    });

    it('should return null for non-existent provider', () => {
      const provider = providerService.getProvider('nonexistent');
      expect(provider).toBeNull();
    });

    it('should be case insensitive', () => {
      const provider = providerService.getProvider('ANTHROPIC');
      expect(provider?.name).toBe('Anthropic');
    });
  });

  describe('addProvider', () => {
    it('should add a valid custom provider', () => {
      const customProvider = {
        name: 'Custom Provider',
        models: ['custom-model-1'],
        baseUrl: 'https://api.custom.com',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
      };

      providerService.addProvider(customProvider);

      const provider = providerService.getProvider('custom provider');
      expect(provider?.name).toBe('Custom Provider');
    });

    it('should throw error for invalid provider', () => {
      const invalidProvider = {
        name: '',
        models: [],
        baseUrl: 'invalid-url',
        rateLimit: { requestsPerMinute: 0, tokensPerMinute: 0 },
      };

      expect(() => providerService.addProvider(invalidProvider)).toThrow('Invalid provider configuration');
    });

    it('should store API key separately when provided', () => {
      const providerWithKey = {
        name: 'Test Provider',
        models: ['test-model'],
        baseUrl: 'https://api.test.com',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
        apiKey: 'test-api-key',
      };

      providerService.addProvider(providerWithKey);

      expect(mockApiKeyService.setApiKey).toHaveBeenCalledWith('test provider', 'test-api-key');
    });
  });

  describe('removeProvider', () => {
    it('should not allow removal of default providers', () => {
      expect(() => providerService.removeProvider('anthropic')).toThrow('Cannot remove default provider');
    });

    it('should remove custom providers', () => {
      // First add a custom provider
      const customProvider = {
        name: 'Custom Provider',
        models: ['custom-model'],
        baseUrl: 'https://api.custom.com',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
      };
      providerService.addProvider(customProvider);

      // Then remove it
      providerService.removeProvider('Custom Provider');

      const provider = providerService.getProvider('custom provider');
      expect(provider).toBeNull();
    });

    it('should throw error for non-existent provider', () => {
      expect(() => providerService.removeProvider('nonexistent')).toThrow('Provider not found');
    });
  });

  describe('getProviderStatus', () => {
    it('should return correct status for configured provider', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(true);
      
      const status = providerService.getProviderStatus('anthropic');
      
      expect(status).toEqual({
        isConfigured: true,
        hasValidApiKey: true,
        isAvailable: true,
      });
    });

    it('should return correct status for unconfigured provider', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(false);
      
      const status = providerService.getProviderStatus('anthropic');
      
      expect(status).toEqual({
        isConfigured: true,
        hasValidApiKey: false,
        isAvailable: false,
      });
    });

    it('should return error status for non-existent provider', () => {
      const status = providerService.getProviderStatus('nonexistent');
      
      expect(status).toEqual({
        isConfigured: false,
        hasValidApiKey: false,
        isAvailable: false,
        lastError: 'Provider not found',
      });
    });
  });

  describe('setActiveProvider', () => {
    it('should set active provider when valid', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(true);
      
      providerService.setActiveProvider('openai');
      
      expect(providerService.getActiveProviderName()).toBe('openai');
    });

    it('should throw error when provider has no API key', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(false);
      
      expect(() => providerService.setActiveProvider('openai')).toThrow('does not have a valid API key');
    });

    it('should throw error for non-existent provider', () => {
      expect(() => providerService.setActiveProvider('nonexistent')).toThrow('Provider not found');
    });

    it('should update active model if current model not available', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(true);
      
      // Set a model that doesn't exist in OpenAI
      providerService.setActiveModel = jest.fn();
      providerService.setActiveProvider('openai');
      
      // Should use first available model from OpenAI
      const openaiProvider = providerService.getProvider('openai');
      expect(providerService.getActiveModel()).toBe(openaiProvider?.models[0]);
    });
  });

  describe('setActiveModel', () => {
    beforeEach(() => {
      mockApiKeyService.hasApiKey.mockReturnValue(true);
      providerService.setActiveProvider('anthropic');
    });

    it('should set active model when valid', () => {
      const anthropicProvider = providerService.getProvider('anthropic');
      const validModel = anthropicProvider?.models[0] || '';
      
      providerService.setActiveModel(validModel);
      
      expect(providerService.getActiveModel()).toBe(validModel);
    });

    it('should throw error for invalid model', () => {
      expect(() => providerService.setActiveModel('invalid-model')).toThrow('Model invalid-model is not available');
    });
  });

  describe('getModelsForProvider', () => {
    it('should return models for valid provider', () => {
      const models = providerService.getModelsForProvider('anthropic');
      expect(models).toEqual(DEFAULT_PROVIDERS.anthropic.models);
    });

    it('should return empty array for invalid provider', () => {
      const models = providerService.getModelsForProvider('nonexistent');
      expect(models).toEqual([]);
    });
  });

  describe('testProvider', () => {
    it('should test provider connection successfully', async () => {
      mockApiKeyService.getApiKey.mockReturnValue('valid-api-key');
      
      const result = await providerService.testProvider('anthropic');
      
      expect(result).toBe(true);
    });

    it('should throw error for unconfigured provider', async () => {
      mockApiKeyService.getApiKey.mockReturnValue(null);
      
      await expect(providerService.testProvider('anthropic')).rejects.toThrow('not properly configured');
    });
  });

  describe('getFallbackProvider', () => {
    it('should return fallback provider when available', () => {
      mockApiKeyService.hasApiKey.mockImplementation((provider) => 
        provider === 'openai' // Only OpenAI has API key
      );
      
      // Set anthropic as active (but it has no API key)
      const fallback = providerService.getFallbackProvider();
      
      expect(fallback?.name).toBe('OpenAI');
    });

    it('should return null when no fallback available', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(false);
      
      const fallback = providerService.getFallbackProvider();
      
      expect(fallback).toBeNull();
    });

    it('should prefer anthropic as fallback', () => {
      mockApiKeyService.hasApiKey.mockImplementation((provider) => 
        provider === 'anthropic' || provider === 'openai'
      );
      
      // Set openai as active
      providerService.setActiveProvider = jest.fn();
      
      const fallback = providerService.getFallbackProvider();
      
      expect(fallback?.name).toBe('Anthropic');
    });
  });

  describe('switchToFallback', () => {
    it('should switch to fallback provider successfully', () => {
      mockApiKeyService.hasApiKey.mockImplementation((provider) => 
        provider === 'openai'
      );
      
      const result = providerService.switchToFallback();
      
      expect(result).toBe(true);
      expect(providerService.getActiveProviderName()).toBe('openai');
    });

    it('should return false when no fallback available', () => {
      mockApiKeyService.hasApiKey.mockReturnValue(false);
      
      const result = providerService.switchToFallback();
      
      expect(result).toBe(false);
    });
  });

  describe('onProviderChange', () => {
    it('should register and call change listeners', () => {
      const mockCallback = jest.fn();
      const unsubscribe = providerService.onProviderChange(mockCallback);

      // Add a provider to trigger change
      const customProvider = {
        name: 'Test Provider',
        models: ['test-model'],
        baseUrl: 'https://api.test.com',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
      };
      providerService.addProvider(customProvider);

      expect(mockCallback).toHaveBeenCalled();

      // Test unsubscribe
      unsubscribe();
      providerService.addProvider({
        ...customProvider,
        name: 'Another Provider',
      });
      
      // Should not be called again after unsubscribe
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportConfiguration', () => {
    it('should export configuration without API keys', () => {
      mockApiKeyService.hasApiKey.mockImplementation((provider) => 
        provider === 'anthropic'
      );
      
      const config = providerService.exportConfiguration();
      
      expect(config).toHaveProperty('activeProvider');
      expect(config).toHaveProperty('activeModel');
      expect(config).toHaveProperty('providers');
      expect(config.providers).toBeInstanceOf(Array);
      
      // Should indicate which providers have API keys without exposing them
      const anthropicConfig = config.providers.find((p: any) => p.key === 'anthropic');
      expect(anthropicConfig?.hasApiKey).toBe(true);
    });
  });
});