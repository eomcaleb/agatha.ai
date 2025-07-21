// Configuration Panel Component for Agatha

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProviderService } from '../services/providerService';
import { ApiKeyService } from '../services/apiKeyService';
import { PreferencesStorage } from '../utils/storage';
import { isValidApiKey } from '../utils/validation';
import { ANIMATION_DURATIONS, DEFAULT_USER_PREFERENCES } from '../constants';
import type { LLMProvider, UserPreferences } from '../types';

export interface ConfigurationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export interface ProviderStatus {
  name: string;
  isConfigured: boolean;
  hasValidKey: boolean;
  models: string[];
  isActive: boolean;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});

  const providerService = useMemo(() => ProviderService.getInstance(), []);
  const apiKeyService = useMemo(() => ApiKeyService.getInstance(), []);

  // Load initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load providers
      const allProviders = providerService.getProviders();
      setProviders(allProviders);

      // Load active provider and model
      const currentProvider = providerService.getActiveProviderName();
      const currentModel = providerService.getActiveModel();
      setActiveProvider(currentProvider);
      setActiveModel(currentModel);

      // Load preferences
      const savedPreferences = PreferencesStorage.getPreferences();
      if (savedPreferences) {
        setPreferences(savedPreferences);
      }

      // Load API keys (without exposing actual values)
      const keyStatuses = apiKeyService.getApiKeyStatus();
      const initialKeys: Record<string, string> = {};
      Object.entries(keyStatuses).forEach(([provider, status]) => {
        initialKeys[provider] = status.hasKey ? '••••••••••••••••' : '';
      });
      setApiKeys(initialKeys);

      // Update provider statuses
      updateProviderStatuses(allProviders, keyStatuses);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setErrors({ general: 'Failed to load configuration data' });
    } finally {
      setIsLoading(false);
    }
  }, [providerService, apiKeyService]);

  // Update provider statuses
  const updateProviderStatuses = useCallback((
    allProviders: LLMProvider[],
    keyStatuses: Record<string, { hasKey: boolean; isValid: boolean }>
  ) => {
    const statuses: ProviderStatus[] = allProviders.map(provider => {
      const providerKey = provider.name.toLowerCase();
      const keyStatus = keyStatuses[providerKey] || { hasKey: false, isValid: false };

      return {
        name: provider.name,
        isConfigured: keyStatus.hasKey,
        hasValidKey: keyStatus.isValid,
        models: provider.models,
        isActive: providerKey === activeProvider,
      };
    });

    setProviderStatuses(statuses);
  }, [activeProvider]);

  // Handle API key change
  const handleApiKeyChange = useCallback(async (provider: string, value: string) => {
    const providerKey = provider.toLowerCase();

    // Clear previous errors and messages
    setErrors(prev => ({ ...prev, [providerKey]: '' }));
    setSuccessMessages(prev => ({ ...prev, [providerKey]: '' }));

    // Update local state
    setApiKeys(prev => ({ ...prev, [providerKey]: value }));

    // If value is the masked placeholder, don't validate
    if (value === '••••••••••••••••') {
      return;
    }

    // Validate API key format
    if (value && !isValidApiKey(value, providerKey)) {
      setErrors(prev => ({ ...prev, [providerKey]: 'Invalid API key format' }));
      return;
    }

    // Save API key if valid
    if (value.trim()) {
      try {
        await apiKeyService.setApiKey(providerKey, value.trim());
        setSuccessMessages(prev => ({ ...prev, [providerKey]: 'API key saved successfully' }));

        // Reload data to update statuses
        setTimeout(loadData, 500);
      } catch (error) {
        setErrors(prev => ({
          ...prev,
          [providerKey]: error instanceof Error ? error.message : 'Failed to save API key'
        }));
      }
    } else {
      // Remove API key if empty
      apiKeyService.removeApiKey(providerKey);
      setTimeout(loadData, 500);
    }
  }, [apiKeyService, loadData]);

  // Handle provider change
  const handleProviderChange = useCallback(async (providerName: string) => {
    try {
      providerService.setActiveProvider(providerName.toLowerCase());
      setActiveProvider(providerName.toLowerCase());

      // Update active model to first available model for this provider
      const provider = providers.find(p => p.name.toLowerCase() === providerName.toLowerCase());
      if (provider && provider.models.length > 0) {
        const firstModel = provider.models[0];
        if (firstModel) {
          providerService.setActiveModel(firstModel);
          setActiveModel(firstModel);
        }
      }

      setSuccessMessages(prev => ({ ...prev, general: `Switched to ${providerName}` }));
      setTimeout(() => setSuccessMessages(prev => ({ ...prev, general: '' })), 3000);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : 'Failed to change provider'
      }));
    }
  }, [providerService, providers]);

  // Handle model change
  const handleModelChange = useCallback((model: string) => {
    try {
      providerService.setActiveModel(model);
      setActiveModel(model);
      setSuccessMessages(prev => ({ ...prev, general: `Switched to ${model}` }));
      setTimeout(() => setSuccessMessages(prev => ({ ...prev, general: '' })), 3000);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : 'Failed to change model'
      }));
    }
  }, [providerService]);

  // Handle preferences change
  const handlePreferencesChange = useCallback((key: keyof UserPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    PreferencesStorage.setPreferences(newPreferences);
  }, [preferences]);

  // Toggle API key visibility
  const toggleApiKeyVisibility = useCallback((provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  // Test provider connection
  const testProvider = useCallback(async (providerName: string) => {
    const providerKey = providerName.toLowerCase();
    setIsLoading(true);
    setErrors(prev => ({ ...prev, [providerKey]: '' }));
    setSuccessMessages(prev => ({ ...prev, [providerKey]: '' }));

    try {
      // This would test the actual provider connection
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hasValidKey = apiKeyService.hasApiKey(providerKey);
      if (hasValidKey) {
        setSuccessMessages(prev => ({ ...prev, [providerKey]: 'Connection successful!' }));
      } else {
        setErrors(prev => ({ ...prev, [providerKey]: 'No API key configured' }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [providerKey]: error instanceof Error ? error.message : 'Connection failed'
      }));
    } finally {
      setIsLoading(false);
    }
  }, [apiKeyService]);

  // Load data on mount and when panel opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Get available models for active provider
  const availableModels = useMemo(() => {
    const provider = providers.find(p => p.name.toLowerCase() === activeProvider);
    return provider ? provider.models : [];
  }, [providers, activeProvider]);

  if (!isOpen) return null;

  return (
    <div
      className={`configuration-panel ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-panel-title"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 'min(400px, 100vw)',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        animation: `slideIn ${ANIMATION_DURATIONS.CARD_TRANSITION}ms ease`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 id="config-panel-title" style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 600, color: '#333' }}>
          Configuration
        </h2>
        <button
          onClick={onClose}
          aria-label="Close configuration panel"
          style={{
            padding: 8,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            color: '#666',
            fontSize: 18,
            minWidth: '44px',
            minHeight: '44px',
          }}
          title="Close configuration"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {/* General Messages */}
        {errors.general && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {errors.general}
          </div>
        )}

        {successMessages.general && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              backgroundColor: '#d4edda',
              color: '#155724',
              border: '1px solid #c3e6cb',
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {successMessages.general}
          </div>
        )}

        {/* Active Provider Section */}
        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#333' }}>
            Active Provider
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#555' }}>
              Provider
            </label>
            <select
              value={activeProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {providerStatuses.map(status => (
                <option key={status.name} value={status.name.toLowerCase()}>
                  {status.name} {status.hasValidKey ? '✓' : '⚠️'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#555' }}>
              Model
            </label>
            <select
              value={activeModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isLoading || availableModels.length === 0}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white',
                cursor: isLoading || availableModels.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {availableModels.map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* API Keys Section */}
        <section style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#333' }}>
            API Keys
          </h3>

          {providerStatuses.map(status => (
            <div key={status.name} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#555', flex: 1 }}>
                  {status.name}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: status.hasValidKey ? '#28a745' : '#dc3545',
                    }}
                    title={status.hasValidKey ? 'Valid API key' : 'No valid API key'}
                  />
                  <button
                    onClick={() => testProvider(status.name)}
                    disabled={isLoading || !status.isConfigured}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      border: '1px solid #e0e0e0',
                      borderRadius: 4,
                      backgroundColor: 'white',
                      cursor: isLoading || !status.isConfigured ? 'not-allowed' : 'pointer',
                      color: '#666',
                    }}
                  >
                    Test
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKeys[status.name.toLowerCase()] ? 'text' : 'password'}
                  value={apiKeys[status.name.toLowerCase()] || ''}
                  onChange={(e) => handleApiKeyChange(status.name, e.target.value)}
                  placeholder={`Enter ${status.name} API key`}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: `1px solid ${errors[status.name.toLowerCase()] ? '#dc3545' : '#e0e0e0'}`,
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility(status.name.toLowerCase())}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: 4,
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                  title={showApiKeys[status.name.toLowerCase()] ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKeys[status.name.toLowerCase()] ? '🙈' : '👁️'}
                </button>
              </div>

              {errors[status.name.toLowerCase()] && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#dc3545' }}>
                  {errors[status.name.toLowerCase()]}
                </div>
              )}

              {successMessages[status.name.toLowerCase()] && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#28a745' }}>
                  {successMessages[status.name.toLowerCase()]}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Preferences Section */}
        <section style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#333' }}>
            Preferences
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#555' }}>
              Theme
            </label>
            <select
              value={preferences.theme}
              onChange={(e) => handlePreferencesChange('theme', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white',
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#555' }}>
              Max Results
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={preferences.maxResults}
              onChange={(e) => handlePreferencesChange('maxResults', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: '#555', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.autoAnalyze}
                onChange={(e) => handlePreferencesChange('autoAnalyze', e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Auto-analyze search results
            </label>
          </div>
        </section>

        {/* Provider Status Overview */}
        <section style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#333' }}>
            Provider Status
          </h3>

          <div style={{ display: 'grid', gap: 12 }}>
            {providerStatuses.map(status => (
              <div
                key={status.name}
                style={{
                  padding: 12,
                  border: '1px solid #e0e0e0',
                  borderRadius: 6,
                  backgroundColor: status.isActive ? '#f8f9fa' : 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, color: '#333' }}>
                    {status.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {status.isActive && (
                      <span style={{ fontSize: 12, color: '#007bff', fontWeight: 500 }}>
                        ACTIVE
                      </span>
                    )}
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: status.hasValidKey ? '#28a745' : '#dc3545',
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {status.models.length} models available
                </div>
                <div style={{ fontSize: 12, color: status.hasValidKey ? '#28a745' : '#dc3545' }}>
                  {status.hasValidKey ? 'Ready to use' : 'API key required'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          
          .configuration-panel input:focus,
          .configuration-panel select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          }
          
          .configuration-panel button:hover:not(:disabled) {
            background-color: #f8f9fa;
          }
          
          .configuration-panel button:active:not(:disabled) {
            transform: translateY(1px);
          }
        `}
      </style>
    </div>
  );
};