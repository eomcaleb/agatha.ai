// LLM Provider Configuration Service for Agatha

import { DEFAULT_PROVIDERS, STORAGE_KEYS } from '../constants';
import { ApiKeyService } from './apiKeyService';
import { validateProvider } from '../utils/validation';
import { createConfigurationError, createAPIError } from '../utils/errors';
import type { LLMProvider, ConfigurationError, APIError } from '../types';

export interface ProviderStatus {
  isConfigured: boolean;
  hasValidApiKey: boolean;
  isAvailable: boolean;
  lastError?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  costPer1kTokens?: number;
}

export class ProviderService {
  private static instance: ProviderService;
  private providers: Map<string, LLMProvider> = new Map();
  private apiKeyService: ApiKeyService;
  private providerChangeListeners: Array<(providers: LLMProvider[]) => void> = [];
  private activeProvider: string = 'anthropic';
  private activeModel: string = 'claude-3-5-sonnet-20241022';

  private constructor() {
    this.apiKeyService = ApiKeyService.getInstance();
    this.initializeDefaultProviders();
    this.loadConfiguration();
  }

  static getInstance(): ProviderService {
    if (!ProviderService.instance) {
      ProviderService.instance = new ProviderService();
    }
    return ProviderService.instance;
  }

  /**
   * Initialize default providers from constants
   */
  private initializeDefaultProviders(): void {
    Object.entries(DEFAULT_PROVIDERS).forEach(([key, providerConfig]) => {
      const provider: LLMProvider = {
        ...providerConfig,
        apiKey: undefined, // API keys are managed separately
      };
      this.providers.set(key, provider);
    });
  }

  /**
   * Load configuration from storage
   */
  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
      if (stored) {
        const config = JSON.parse(stored);
        this.activeProvider = config.activeProvider || 'anthropic';
        this.activeModel = config.activeModel || 'claude-3-5-sonnet-20241022';
        
        // Load custom providers if any
        if (config.customProviders) {
          Object.entries(config.customProviders).forEach(([key, provider]) => {
            this.providers.set(key, provider as LLMProvider);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load provider configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfiguration(): void {
    try {
      const customProviders: Record<string, LLMProvider> = {};
      
      // Only save custom providers (not defaults)
      this.providers.forEach((provider, key) => {
        if (!DEFAULT_PROVIDERS[key]) {
          customProviders[key] = provider;
        }
      });

      const config = {
        activeProvider: this.activeProvider,
        activeModel: this.activeModel,
        customProviders: Object.keys(customProviders).length > 0 ? customProviders : undefined,
      };

      localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save provider configuration:', error);
    }
  }

  /**
   * Get all available providers
   */
  getProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).map(provider => ({
      ...provider,
      apiKey: this.apiKeyService.getApiKey(provider.name.toLowerCase()) || undefined,
    }));
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): LLMProvider | null {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      return null;
    }

    return {
      ...provider,
      apiKey: this.apiKeyService.getApiKey(name.toLowerCase()) || undefined,
    };
  }

  /**
   * Add or update a provider
   */
  addProvider(provider: LLMProvider): void {
    const errors = validateProvider(provider);
    if (errors.length > 0) {
      throw createConfigurationError(
        `Invalid provider configuration: ${errors.join(', ')}`,
        'provider',
        'validation_failed'
      );
    }

    const key = provider.name.toLowerCase();
    this.providers.set(key, { ...provider, apiKey: undefined });
    
    // Store API key separately if provided
    if (provider.apiKey) {
      this.apiKeyService.setApiKey(key, provider.apiKey);
    }

    this.saveConfiguration();
    this.notifyProviderChange();
  }

  /**
   * Remove a provider
   */
  removeProvider(name: string): void {
    const key = name.toLowerCase();
    
    // Don't allow removal of default providers
    if (DEFAULT_PROVIDERS[key]) {
      throw createConfigurationError(
        `Cannot remove default provider: ${name}`,
        'provider',
        'cannot_remove_default'
      );
    }

    if (!this.providers.has(key)) {
      throw createConfigurationError(
        `Provider not found: ${name}`,
        'provider',
        'not_found'
      );
    }

    this.providers.delete(key);
    this.apiKeyService.removeApiKey(key);

    // Switch to default provider if removing active provider
    if (this.activeProvider === key) {
      this.setActiveProvider('anthropic');
    }

    this.saveConfiguration();
    this.notifyProviderChange();
  }

  /**
   * Get provider status
   */
  getProviderStatus(name: string): ProviderStatus {
    const provider = this.getProvider(name);
    if (!provider) {
      return {
        isConfigured: false,
        hasValidApiKey: false,
        isAvailable: false,
        lastError: 'Provider not found',
      };
    }

    const hasValidApiKey = this.apiKeyService.hasApiKey(name.toLowerCase());
    
    return {
      isConfigured: true,
      hasValidApiKey,
      isAvailable: hasValidApiKey,
    };
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): Record<string, ProviderStatus> {
    const statuses: Record<string, ProviderStatus> = {};
    
    this.providers.forEach((provider, key) => {
      statuses[key] = this.getProviderStatus(key);
    });

    return statuses;
  }

  /**
   * Set active provider
   */
  setActiveProvider(name: string): void {
    const key = name.toLowerCase();
    const provider = this.providers.get(key);
    
    if (!provider) {
      throw createConfigurationError(
        `Provider not found: ${name}`,
        'activeProvider',
        'not_found'
      );
    }

    const status = this.getProviderStatus(key);
    if (!status.hasValidApiKey) {
      throw createConfigurationError(
        `Provider ${name} does not have a valid API key`,
        'activeProvider',
        'no_api_key'
      );
    }

    this.activeProvider = key;
    
    // Set default model for the provider if current model is not available
    if (!provider.models.includes(this.activeModel)) {
      this.activeModel = provider.models[0] || '';
    }

    this.saveConfiguration();
  }

  /**
   * Get active provider
   */
  getActiveProvider(): LLMProvider | null {
    return this.getProvider(this.activeProvider);
  }

  /**
   * Get active provider name
   */
  getActiveProviderName(): string {
    return this.activeProvider;
  }

  /**
   * Set active model
   */
  setActiveModel(model: string): void {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw createConfigurationError(
        'No active provider set',
        'activeModel',
        'no_active_provider'
      );
    }

    if (!provider.models.includes(model)) {
      throw createConfigurationError(
        `Model ${model} is not available for provider ${provider.name}`,
        'activeModel',
        'model_not_available'
      );
    }

    this.activeModel = model;
    this.saveConfiguration();
  }

  /**
   * Get active model
   */
  getActiveModel(): string {
    return this.activeModel;
  }

  /**
   * Get available models for a provider
   */
  getModelsForProvider(name: string): string[] {
    const provider = this.getProvider(name);
    return provider ? provider.models : [];
  }

  /**
   * Get available models for active provider
   */
  getAvailableModels(): string[] {
    const provider = this.getActiveProvider();
    return provider ? provider.models : [];
  }

  /**
   * Test provider connection
   */
  async testProvider(name: string): Promise<boolean> {
    const provider = this.getProvider(name);
    if (!provider || !provider.apiKey) {
      throw createConfigurationError(
        `Provider ${name} is not properly configured`,
        'provider',
        'not_configured'
      );
    }

    try {
      // This would make an actual API call to test the connection
      // For now, we'll simulate it
      await this.makeTestRequest(provider);
      return true;
    } catch (error) {
      throw createAPIError(
        `Failed to connect to ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        name,
        undefined,
        false
      );
    }
  }

  /**
   * Get provider configuration for export
   */
  exportConfiguration(): Record<string, any> {
    return {
      activeProvider: this.activeProvider,
      activeModel: this.activeModel,
      providers: Array.from(this.providers.entries()).map(([key, provider]) => ({
        key,
        name: provider.name,
        models: provider.models,
        baseUrl: provider.baseUrl,
        rateLimit: provider.rateLimit,
        hasApiKey: this.apiKeyService.hasApiKey(key),
      })),
    };
  }

  /**
   * Add listener for provider changes
   */
  onProviderChange(callback: (providers: LLMProvider[]) => void): () => void {
    this.providerChangeListeners.push(callback);
    
    return () => {
      const index = this.providerChangeListeners.indexOf(callback);
      if (index > -1) {
        this.providerChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get fallback provider if active provider fails
   */
  getFallbackProvider(): LLMProvider | null {
    const statuses = this.getAllProviderStatuses();
    const availableProviders = Object.entries(statuses)
      .filter(([key, status]) => key !== this.activeProvider && status.isAvailable)
      .map(([key]) => key);

    if (availableProviders.length === 0) {
      return null;
    }

    // Prefer anthropic as fallback, then openai
    const preferredOrder = ['anthropic', 'openai', 'gemini', 'xai'];
    for (const preferred of preferredOrder) {
      if (availableProviders.includes(preferred)) {
        return this.getProvider(preferred);
      }
    }

    // Return first available if no preferred found
    return this.getProvider(availableProviders[0]);
  }

  /**
   * Switch to fallback provider
   */
  switchToFallback(): boolean {
    const fallback = this.getFallbackProvider();
    if (!fallback) {
      return false;
    }

    try {
      this.setActiveProvider(fallback.name);
      return true;
    } catch (error) {
      console.error('Failed to switch to fallback provider:', error);
      return false;
    }
  }

  /**
   * Make a test request to validate provider
   */
  private async makeTestRequest(provider: LLMProvider): Promise<void> {
    // Simulate API test request
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Basic validation - in real implementation, make actual API call
        if (!provider.apiKey || provider.apiKey.length < 10) {
          reject(new Error('Invalid API key'));
          return;
        }
        resolve();
      }, 500);
    });
  }

  /**
   * Notify listeners of provider changes
   */
  private notifyProviderChange(): void {
    const providers = this.getProviders();
    this.providerChangeListeners.forEach(callback => {
      try {
        callback(providers);
      } catch (error) {
        console.error('Error in provider change listener:', error);
      }
    });
  }
}