// Constants for Agatha Intelligence Web Interface

export const DEFAULT_PROVIDERS: Record<string, Omit<import('../types').LLMProvider, 'apiKey'>> = {
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    baseUrl: 'https://api.anthropic.com/v1',
    rateLimit: {
      requestsPerMinute: 50,
      tokensPerMinute: 40000,
    },
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
    },
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 32000,
    },
  },
  xai: {
    name: 'xAI',
    models: ['grok-beta'],
    baseUrl: 'https://api.x.ai/v1',
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 60000,
    },
  },
};

export const DEFAULT_SEARCH_CONFIG = {
  maxResults: 10,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

export const DEFAULT_USER_PREFERENCES: import('../types').UserPreferences = {
  theme: 'dark',
  maxResults: 10,
  autoAnalyze: true,
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-5-sonnet-20241022',
};

export const POPUP_SELECTORS = [
  // Common popup and overlay selectors
  '[class*="popup"]',
  '[class*="modal"]',
  '[class*="overlay"]',
  '[class*="dialog"]',
  '[id*="popup"]',
  '[id*="modal"]',
  '[id*="overlay"]',
  '.cookie-banner',
  '.cookie-notice',
  '.newsletter-popup',
  '.subscription-modal',
  '.ad-overlay',
  '.interstitial',
  // Common z-index based overlays
  '[style*="z-index: 999"]',
  '[style*="z-index: 9999"]',
  '[style*="position: fixed"]',
];

export const IFRAME_SANDBOX_PERMISSIONS = [
  'allow-same-origin',
  'allow-scripts',
  'allow-forms',
  'allow-popups',
  'allow-presentation',
].join(' ');

export const STORAGE_KEYS = {
  API_KEYS: 'agatha_api_keys',
  USER_PREFERENCES: 'agatha_preferences',
  SEARCH_HISTORY: 'agatha_search_history',
  CACHED_RESULTS: 'agatha_cached_results',
  PROVIDER_CONFIG: 'agatha_provider_config',
};

export const ERROR_MESSAGES = {
  NO_API_KEY: 'Please configure your API key for the selected provider',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  RATE_LIMITED: 'Rate limit exceeded. Please wait before making more requests.',
  INVALID_RESPONSE: 'Invalid response from AI provider',
  CONTENT_BLOCKED: 'Content could not be loaded due to security restrictions',
  ANALYSIS_FAILED: 'Failed to analyze content. Please try again.',
  CONFIGURATION_ERROR: 'Configuration error. Please check your settings.',
};

export const ANIMATION_DURATIONS = {
  CARD_TRANSITION: 300,
  SCROLL_SMOOTH: 500,
  FADE_IN: 200,
  FADE_OUT: 150,
};

export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1440,
};

export const CARD_DIMENSIONS = {
  WIDTH: 400,
  HEIGHT: 600,
  MARGIN: 20,
  BORDER_RADIUS: 12,
};