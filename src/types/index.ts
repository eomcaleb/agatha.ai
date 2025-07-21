// Core interfaces for Agatha Intelligence Web Interface

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  description: string;
  relevanceScore: number;
  confidenceScore: number;
  timestamp: Date;
  metadata: {
    domain: string;
    contentType: string;
    loadStatus: 'loading' | 'loaded' | 'error';
  };
}

export interface SearchQuery {
  prompt: string;
  maxResults: number;
  filters?: {
    domains?: string[];
    contentTypes?: string[];
    dateRange?: DateRange;
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LLMProvider {
  name: string;
  models: string[];
  apiKey?: string;
  baseUrl: string;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface AnalysisRequest {
  content: string;
  prompt: string;
  provider: LLMProvider;
  model: string;
}

export interface AnalysisResponse {
  relevanceScore: number;
  confidenceScore: number;
  description: string;
  reasoning: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  maxResults: number;
  autoAnalyze: boolean;
  defaultProvider: string;
  defaultModel: string;
}

export interface AppState {
  search: {
    query: SearchQuery | null;
    results: SearchResult[];
    status: 'idle' | 'searching' | 'analyzing' | 'complete' | 'error';
    error: string | null;
  };
  ui: {
    selectedResult: string | null;
    cardPosition: number;
    viewMode: 'cards' | 'iframe' | 'split';
    theme: 'light' | 'dark';
  };
  configuration: {
    providers: LLMProvider[];
    activeProvider: string;
    activeModel: string;
    preferences: UserPreferences;
  };
}

// Error types
export interface NetworkError extends Error {
  type: 'network';
  status?: number;
  url?: string;
}

export interface APIError extends Error {
  type: 'api';
  provider: string;
  statusCode?: number;
  rateLimited?: boolean;
}

export interface ContentError extends Error {
  type: 'content';
  url: string;
  reason: 'blocked' | 'cors' | 'timeout' | 'invalid';
}

export interface ConfigurationError extends Error {
  type: 'configuration';
  field: string;
  reason: string;
}

export type AgathaError = NetworkError | APIError | ContentError | ConfigurationError;

// Component props interfaces
export interface ResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
}

export interface HorizontalCardContainerProps {
  results: SearchResult[];
  selectedId: string | null;
  onResultSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
}

export interface IframeViewerProps {
  url: string;
  title: string;
  onLoad?: () => void;
  onError?: (error: ContentError) => void;
}

export interface SearchInputProps {
  onSearch: (query: SearchQuery) => void;
  isLoading: boolean;
  placeholder?: string;
}

export interface ConfigurationPanelProps {
  providers: LLMProvider[];
  activeProvider: string;
  activeModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onApiKeyUpdate: (provider: string, apiKey: string) => void;
}