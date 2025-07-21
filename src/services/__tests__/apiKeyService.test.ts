// Tests for API Key Management Service

import { ApiKeyService } from '../apiKeyService';
import { SecureStorage } from '../../utils/storage';
import { createConfigurationError } from '../../utils/errors';

// Mock the storage utilities
jest.mock('../../utils/storage');
const mockSecureStorage = SecureStorage as jest.Mocked<typeof SecureStorage>;

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    // Reset the singleton instance
    (ApiKeyService as any).instance = undefined;
    apiKeyService = ApiKeyService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockSecureStorage.getApiKeys.mockReturnValue({});
    mockSecureStorage.getApiKey.mockReturnValue(null);
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ApiKeyService.getInstance();
      const instance2 = ApiKeyService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('setApiKey', () => {
    it('should set a valid API key', async () => {
      const provider = 'anthropic';
      const apiKey = 'sk-ant-test123456789';

      await apiKeyService.setApiKey(provider, apiKey);

      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith(provider, apiKey);
    });

    it('should throw error for missing provider', async () => {
      await expect(apiKeyService.setApiKey('', 'test-key')).rejects.toThrow('Provider name is required');
    });

    it('should throw error for missing API key', async () => {
      await expect(apiKeyService.setApiKey('anthropic', '')).rejects.toThrow('API key is required');
    });

    it('should throw error for invalid API key format', async () => {
      await expect(apiKeyService.setApiKey('anthropic', 'invalid-key')).rejects.toThrow('Invalid API key format');
    });

    it('should validate OpenAI API key format', async () => {
      const provider = 'openai';
      const apiKey = 'sk-test123456789';

      await apiKeyService.setApiKey(provider, apiKey);

      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith(provider, apiKey);
    });

    it('should validate xAI API key format', async () => {
      const provider = 'xai';
      const apiKey = 'xai-test123456789';

      await apiKeyService.setApiKey(provider, apiKey);

      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith(provider, apiKey);
    });
  });

  describe('getApiKey', () => {
    it('should return API key for valid provider', () => {
      const provider = 'anthropic';
      const apiKey = 'sk-ant-test123';
      mockSecureStorage.getApiKey.mockReturnValue(apiKey);

      const result = apiKeyService.getApiKey(provider);

      expect(result).toBe(apiKey);
      expect(mockSecureStorage.getApiKey).toHaveBeenCalledWith(provider);
    });

    it('should return null for invalid provider', () => {
      const result = apiKeyService.getApiKey('');
      expect(result).toBeNull();
    });

    it('should return null when no key exists', () => {
      mockSecureStorage.getApiKey.mockReturnValue(null);
      const result = apiKeyService.getApiKey('anthropic');
      expect(result).toBeNull();
    });
  });

  describe('hasApiKey', () => {
    it('should return true when API key exists', () => {
      mockSecureStorage.getApiKey.mockReturnValue('sk-ant-test123');
      const result = apiKeyService.hasApiKey('anthropic');
      expect(result).toBe(true);
    });

    it('should return false when API key does not exist', () => {
      mockSecureStorage.getApiKey.mockReturnValue(null);
      const result = apiKeyService.hasApiKey('anthropic');
      expect(result).toBe(false);
    });

    it('should return false when API key is empty', () => {
      mockSecureStorage.getApiKey.mockReturnValue('');
      const result = apiKeyService.hasApiKey('anthropic');
      expect(result).toBe(false);
    });
  });

  describe('removeApiKey', () => {
    it('should remove API key for valid provider', () => {
      apiKeyService.removeApiKey('anthropic');
      expect(mockSecureStorage.removeApiKey).toHaveBeenCalledWith('anthropic');
    });

    it('should handle invalid provider gracefully', () => {
      apiKeyService.removeApiKey('');
      expect(mockSecureStorage.removeApiKey).not.toHaveBeenCalled();
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return list of providers with API keys', () => {
      mockSecureStorage.getApiKeys.mockReturnValue({
        anthropic: 'encrypted-key-1',
        openai: 'encrypted-key-2',
        gemini: '',
      });

      const result = apiKeyService.getConfiguredProviders();

      expect(result).toEqual(['anthropic', 'openai']);
    });

    it('should return empty array when no keys configured', () => {
      mockSecureStorage.getApiKeys.mockReturnValue({});
      const result = apiKeyService.getConfiguredProviders();
      expect(result).toEqual([]);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should validate correct Anthropic API key format', () => {
      const result = apiKeyService.validateApiKeyFormat('anthropic', 'sk-ant-test123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject incorrect Anthropic API key format', () => {
      const result = apiKeyService.validateApiKeyFormat('anthropic', 'invalid-key');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key format for anthropic');
    });

    it('should reject missing provider', () => {
      const result = apiKeyService.validateApiKeyFormat('', 'sk-ant-test123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Provider name is required');
    });

    it('should reject missing API key', () => {
      const result = apiKeyService.validateApiKeyFormat('anthropic', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key is required');
    });
  });

  describe('clearAllApiKeys', () => {
    it('should clear all stored API keys', () => {
      mockSecureStorage.getApiKeys.mockReturnValue({
        anthropic: 'key1',
        openai: 'key2',
      });

      apiKeyService.clearAllApiKeys();

      expect(mockSecureStorage.clearAllApiKeys).toHaveBeenCalled();
    });
  });

  describe('onApiKeyChange', () => {
    it('should register and call change listeners', async () => {
      const mockCallback = jest.fn();
      const unsubscribe = apiKeyService.onApiKeyChange(mockCallback);

      await apiKeyService.setApiKey('anthropic', 'sk-ant-test123');

      expect(mockCallback).toHaveBeenCalledWith('anthropic', true);

      // Test unsubscribe
      unsubscribe();
      apiKeyService.removeApiKey('anthropic');
      
      // Should not be called again after unsubscribe
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', async () => {
      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      apiKeyService.onApiKeyChange(mockCallback);
      await apiKeyService.setApiKey('anthropic', 'sk-ant-test123');

      expect(consoleSpy).toHaveBeenCalledWith('Error in API key change listener:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getApiKeyStatus', () => {
    it('should return status for all known providers', () => {
      mockSecureStorage.getApiKey
        .mockReturnValueOnce('sk-ant-test123') // anthropic
        .mockReturnValueOnce('sk-test123') // openai
        .mockReturnValueOnce(null) // gemini
        .mockReturnValueOnce('xai-test123'); // xai

      const result = apiKeyService.getApiKeyStatus();

      expect(result).toEqual({
        anthropic: { hasKey: true, isValid: true },
        openai: { hasKey: true, isValid: true },
        gemini: { hasKey: false, isValid: false },
        xai: { hasKey: true, isValid: true },
      });
    });
  });

  describe('exportConfiguration', () => {
    it('should export configuration without actual keys', () => {
      mockSecureStorage.getApiKeys.mockReturnValue({
        anthropic: 'encrypted-key-1',
        openai: 'encrypted-key-2',
      });

      const result = apiKeyService.exportConfiguration();

      expect(result).toEqual({
        anthropic: true,
        openai: true,
      });
    });
  });
});