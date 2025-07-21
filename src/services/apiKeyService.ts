// API Key Management Service for Agatha

import { SecureStorage } from '../utils/storage';
import { isValidApiKey } from '../utils/validation';
import { createConfigurationError } from '../utils/errors';
import type { ConfigurationError } from '../types';

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
}

export class ApiKeyService {
  private static instance: ApiKeyService;
  private keyChangeListeners: Array<(provider: string, hasKey: boolean) => void> = [];

  private constructor() {}

  static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Set API key for a provider with validation
   */
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    if (!provider || typeof provider !== 'string') {
      throw createConfigurationError('Provider name is required', 'provider', 'missing');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw createConfigurationError('API key is required', 'apiKey', 'missing');
    }

    // Validate API key format
    if (!isValidApiKey(apiKey, provider)) {
      throw createConfigurationError(
        `Invalid API key format for ${provider}`,
        'apiKey',
        'invalid_format'
      );
    }

    try {
      // Test the API key by making a simple request
      await this.validateApiKeyWithProvider(provider, apiKey);
      
      // Store the key if validation passes
      SecureStorage.setApiKey(provider, apiKey);
      
      // Notify listeners
      this.notifyKeyChange(provider, true);
    } catch (error) {
      throw createConfigurationError(
        `Failed to validate API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'apiKey',
        'validation_failed'
      );
    }
  }

  /**
   * Get API key for a provider
   */
  getApiKey(provider: string): string | null {
    if (!provider || typeof provider !== 'string') {
      return null;
    }

    return SecureStorage.getApiKey(provider);
  }

  /**
   * Check if provider has a valid API key
   */
  hasApiKey(provider: string): boolean {
    const apiKey = this.getApiKey(provider);
    return apiKey !== null && apiKey.length > 0;
  }

  /**
   * Remove API key for a provider
   */
  removeApiKey(provider: string): void {
    if (!provider || typeof provider !== 'string') {
      return;
    }

    SecureStorage.removeApiKey(provider);
    this.notifyKeyChange(provider, false);
  }

  /**
   * Get all providers that have API keys configured
   */
  getConfiguredProviders(): string[] {
    const keys = SecureStorage.getApiKeys();
    return Object.keys(keys).filter(provider => keys[provider] && keys[provider].length > 0);
  }

  /**
   * Validate API key format without storing
   */
  validateApiKeyFormat(provider: string, apiKey: string): ApiKeyValidationResult {
    if (!provider || typeof provider !== 'string') {
      return { isValid: false, error: 'Provider name is required' };
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API key is required' };
    }

    if (!isValidApiKey(apiKey, provider)) {
      return { isValid: false, error: `Invalid API key format for ${provider}` };
    }

    return { isValid: true };
  }

  /**
   * Clear all API keys
   */
  clearAllApiKeys(): void {
    const configuredProviders = this.getConfiguredProviders();
    SecureStorage.clearAllApiKeys();
    
    // Notify listeners for all cleared providers
    configuredProviders.forEach(provider => {
      this.notifyKeyChange(provider, false);
    });
  }

  /**
   * Add listener for API key changes
   */
  onApiKeyChange(callback: (provider: string, hasKey: boolean) => void): () => void {
    this.keyChangeListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.keyChangeListeners.indexOf(callback);
      if (index > -1) {
        this.keyChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Validate API key with the actual provider
   */
  private async validateApiKeyWithProvider(provider: string, apiKey: string): Promise<void> {
    // This is a basic validation - in a real implementation, you'd make actual API calls
    // For now, we'll do a simple format check and simulate async validation
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          // Simulate API validation
          if (!isValidApiKey(apiKey, provider)) {
            reject(new Error('Invalid API key format'));
            return;
          }

          // Additional provider-specific validation could go here
          switch (provider.toLowerCase()) {
            case 'anthropic':
              if (!apiKey.startsWith('sk-ant-')) {
                reject(new Error('Anthropic API keys must start with sk-ant-'));
                return;
              }
              break;
            case 'openai':
              if (!apiKey.startsWith('sk-')) {
                reject(new Error('OpenAI API keys must start with sk-'));
                return;
              }
              break;
            case 'xai':
              if (!apiKey.startsWith('xai-')) {
                reject(new Error('xAI API keys must start with xai-'));
                return;
              }
              break;
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      }, 100); // Simulate network delay
    });
  }

  /**
   * Notify all listeners of API key changes
   */
  private notifyKeyChange(provider: string, hasKey: boolean): void {
    this.keyChangeListeners.forEach(callback => {
      try {
        callback(provider, hasKey);
      } catch (error) {
        console.error('Error in API key change listener:', error);
      }
    });
  }

  /**
   * Export configuration for backup
   */
  exportConfiguration(): Record<string, boolean> {
    const configuredProviders = this.getConfiguredProviders();
    const config: Record<string, boolean> = {};
    
    configuredProviders.forEach(provider => {
      config[provider] = true; // Don't export actual keys for security
    });
    
    return config;
  }

  /**
   * Get API key status for all known providers
   */
  getApiKeyStatus(): Record<string, { hasKey: boolean; isValid: boolean }> {
    const knownProviders = ['anthropic', 'openai', 'gemini', 'xai'];
    const status: Record<string, { hasKey: boolean; isValid: boolean }> = {};

    knownProviders.forEach(provider => {
      const apiKey = this.getApiKey(provider);
      const hasKey = apiKey !== null && apiKey.length > 0;
      const isValid = hasKey ? isValidApiKey(apiKey, provider) : false;
      
      status[provider] = { hasKey, isValid };
    });

    return status;
  }
}