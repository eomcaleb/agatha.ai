// Tests for ConfigurationPanel Component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationPanel } from '../ConfigurationPanel';
import { ProviderService } from '../../services/providerService';
import { ApiKeyService } from '../../services/apiKeyService';
import { PreferencesStorage } from '../../utils/storage';

// Mock dependencies
jest.mock('../../services/providerService');
jest.mock('../../services/apiKeyService');
jest.mock('../../utils/storage');
jest.mock('../../utils/validation', () => ({
  isValidApiKey: jest.fn((key: string, provider: string) => key.startsWith('sk-')),
}));

jest.mock('../../constants', () => ({
  ANIMATION_DURATIONS: {
    CARD_TRANSITION: 300,
  },
  DEFAULT_USER_PREFERENCES: {
    theme: 'dark',
    maxResults: 10,
    autoAnalyze: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
}));

const mockProviderService = {
  getProviders: jest.fn(),
  getActiveProviderName: jest.fn(),
  getActiveModel: jest.fn(),
  setActiveProvider: jest.fn(),
  setActiveModel: jest.fn(),
} as jest.Mocked<Partial<ProviderService>>;

const mockApiKeyService = {
  getApiKeyStatus: jest.fn(),
  hasApiKey: jest.fn(),
  setApiKey: jest.fn(),
  removeApiKey: jest.fn(),
} as jest.Mocked<Partial<ApiKeyService>>;

const mockPreferencesStorage = PreferencesStorage as jest.Mocked<typeof PreferencesStorage>;

describe('ConfigurationPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ProviderService.getInstance
    (ProviderService.getInstance as jest.Mock).mockReturnValue(mockProviderService);
    
    // Mock ApiKeyService.getInstance
    (ApiKeyService.getInstance as jest.Mock).mockReturnValue(mockApiKeyService);

    // Setup default mock data
    mockProviderService.getProviders.mockReturnValue([
      {
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        baseUrl: 'https://api.anthropic.com/v1',
        rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
      },
      {
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini'],
        baseUrl: 'https://api.openai.com/v1',
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000 },
      },
    ]);

    mockProviderService.getActiveProviderName.mockReturnValue('anthropic');
    mockProviderService.getActiveModel.mockReturnValue('claude-3-5-sonnet-20241022');

    mockApiKeyService.getApiKeyStatus.mockReturnValue({
      anthropic: { hasKey: true, isValid: true },
      openai: { hasKey: false, isValid: false },
    });

    mockPreferencesStorage.getPreferences.mockReturnValue({
      theme: 'dark',
      maxResults: 10,
      autoAnalyze: true,
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-5-sonnet-20241022',
    });
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ConfigurationPanel {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Active Provider')).toBeInTheDocument();
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Preferences')).toBeInTheDocument();
    });

    it('should show close button', () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      expect(screen.getByTitle('Close configuration')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ConfigurationPanel {...defaultProps} className="custom-config" />);
      
      expect(document.querySelector('.configuration-panel')).toHaveClass('custom-config');
    });
  });

  describe('provider selection', () => {
    it('should display available providers', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Anthropic ✓')).toBeInTheDocument();
        expect(screen.getByText('OpenAI ⚠️')).toBeInTheDocument();
      });
    });

    it('should show active provider as selected', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        const providerSelect = screen.getByDisplayValue('anthropic');
        expect(providerSelect).toBeInTheDocument();
      });
    });

    it('should change active provider when selection changes', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument();
      });

      const providerSelect = screen.getByDisplayValue('anthropic');
      await user.selectOptions(providerSelect, 'openai');

      expect(mockProviderService.setActiveProvider).toHaveBeenCalledWith('openai');
    });
  });

  describe('model selection', () => {
    it('should display available models for active provider', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        const modelSelect = screen.getByDisplayValue('claude-3-5-sonnet-20241022');
        expect(modelSelect).toBeInTheDocument();
      });
    });

    it('should change active model when selection changes', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('claude-3-5-sonnet-20241022')).toBeInTheDocument();
      });

      const modelSelect = screen.getByDisplayValue('claude-3-5-sonnet-20241022');
      await user.selectOptions(modelSelect, 'claude-3-5-haiku-20241022');

      expect(mockProviderService.setActiveModel).toHaveBeenCalledWith('claude-3-5-haiku-20241022');
    });
  });

  describe('API key management', () => {
    it('should show API key inputs for all providers', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter Anthropic API key')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter OpenAI API key')).toBeInTheDocument();
      });
    });

    it('should show masked API keys for configured providers', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        const anthropicInput = screen.getByPlaceholderText('Enter Anthropic API key');
        expect(anthropicInput).toHaveValue('••••••••••••••••');
      });
    });

    it('should toggle API key visibility', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByTitle('Show API key')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTitle('Show API key');
      await user.click(toggleButton);

      expect(screen.getByTitle('Hide API key')).toBeInTheDocument();
    });

    it('should save API key when valid key is entered', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter OpenAI API key')).toBeInTheDocument();
      });

      const openaiInput = screen.getByPlaceholderText('Enter OpenAI API key');
      await user.clear(openaiInput);
      await user.type(openaiInput, 'sk-test123456789');

      expect(mockApiKeyService.setApiKey).toHaveBeenCalledWith('openai', 'sk-test123456789');
    });

    it('should show error for invalid API key format', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter OpenAI API key')).toBeInTheDocument();
      });

      const openaiInput = screen.getByPlaceholderText('Enter OpenAI API key');
      await user.clear(openaiInput);
      await user.type(openaiInput, 'invalid-key');

      await waitFor(() => {
        expect(screen.getByText('Invalid API key format')).toBeInTheDocument();
      });
    });

    it('should test provider connection', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test')[0]).toBeInTheDocument();
      });

      const testButton = screen.getAllByText('Test')[0];
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connection successful!')).toBeInTheDocument();
      });
    });
  });

  describe('preferences', () => {
    it('should display current preferences', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { checked: true })).toBeInTheDocument();
      });
    });

    it('should update theme preference', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
      });

      const themeSelect = screen.getByDisplayValue('dark');
      await user.selectOptions(themeSelect, 'light');

      expect(mockPreferencesStorage.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'light' })
      );
    });

    it('should update max results preference', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      });

      const maxResultsInput = screen.getByDisplayValue('10');
      await user.clear(maxResultsInput);
      await user.type(maxResultsInput, '20');

      expect(mockPreferencesStorage.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 20 })
      );
    });

    it('should toggle auto-analyze preference', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { checked: true })).toBeInTheDocument();
      });

      const autoAnalyzeCheckbox = screen.getByRole('checkbox', { checked: true });
      await user.click(autoAnalyzeCheckbox);

      expect(mockPreferencesStorage.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ autoAnalyze: false })
      );
    });
  });

  describe('provider status overview', () => {
    it('should show provider status cards', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Provider Status')).toBeInTheDocument();
        expect(screen.getByText('Ready to use')).toBeInTheDocument();
        expect(screen.getByText('API key required')).toBeInTheDocument();
      });
    });

    it('should highlight active provider', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      });
    });

    it('should show model count for each provider', async () => {
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('2 models available')).toBeInTheDocument();
      });
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      const closeButton = screen.getByTitle('Close configuration');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('should disable inputs when loading', async () => {
      mockProviderService.getProviders.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve([]), 1000));
      });

      render(<ConfigurationPanel {...defaultProps} />);
      
      // Inputs should be disabled during loading
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          expect(input).toBeDisabled();
        });
      });
    });
  });

  describe('error handling', () => {
    it('should show error when provider change fails', async () => {
      const user = userEvent.setup();
      mockProviderService.setActiveProvider.mockRejectedValue(new Error('Provider change failed'));
      
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument();
      });

      const providerSelect = screen.getByDisplayValue('anthropic');
      await user.selectOptions(providerSelect, 'openai');

      await waitFor(() => {
        expect(screen.getByText('Provider change failed')).toBeInTheDocument();
      });
    });

    it('should show error when API key save fails', async () => {
      const user = userEvent.setup();
      mockApiKeyService.setApiKey.mockRejectedValue(new Error('API key save failed'));
      
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter OpenAI API key')).toBeInTheDocument();
      });

      const openaiInput = screen.getByPlaceholderText('Enter OpenAI API key');
      await user.clear(openaiInput);
      await user.type(openaiInput, 'sk-test123456789');

      await waitFor(() => {
        expect(screen.getByText('API key save failed')).toBeInTheDocument();
      });
    });
  });

  describe('success messages', () => {
    it('should show success message when provider is changed', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument();
      });

      const providerSelect = screen.getByDisplayValue('anthropic');
      await user.selectOptions(providerSelect, 'openai');

      await waitFor(() => {
        expect(screen.getByText('Switched to openai')).toBeInTheDocument();
      });
    });

    it('should show success message when API key is saved', async () => {
      const user = userEvent.setup();
      render(<ConfigurationPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter OpenAI API key')).toBeInTheDocument();
      });

      const openaiInput = screen.getByPlaceholderText('Enter OpenAI API key');
      await user.clear(openaiInput);
      await user.type(openaiInput, 'sk-test123456789');

      await waitFor(() => {
        expect(screen.getByText('API key saved successfully')).toBeInTheDocument();
      });
    });
  });
});