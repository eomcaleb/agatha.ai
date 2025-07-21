// Global State Management Hook for Agatha

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { PreferencesStorage } from '../utils/storage';
import { DEFAULT_USER_PREFERENCES } from '../constants';
import type { AppState, SearchQuery, SearchResult, UserPreferences } from '../types';

// Action types
export type AppAction =
  | { type: 'SET_SEARCH_QUERY'; payload: SearchQuery }
  | { type: 'SET_SEARCH_STATUS'; payload: AppState['search']['status'] }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResult[] }
  | { type: 'SET_SEARCH_ERROR'; payload: string | null }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'SET_SELECTED_RESULT'; payload: string | null }
  | { type: 'SET_CARD_POSITION'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: AppState['ui']['viewMode'] }
  | { type: 'SET_THEME'; payload: AppState['ui']['theme'] }
  | { type: 'SET_ACTIVE_PROVIDER'; payload: string }
  | { type: 'SET_ACTIVE_MODEL'; payload: string }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'UPDATE_PREFERENCE'; payload: { key: keyof UserPreferences; value: any } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: AppState = {
  search: {
    query: null,
    results: [],
    status: 'idle',
    error: null,
  },
  ui: {
    selectedResult: null,
    cardPosition: 0,
    viewMode: 'cards',
    theme: 'dark',
  },
  configuration: {
    providers: [],
    activeProvider: 'anthropic',
    activeModel: 'claude-3-5-sonnet-20241022',
    preferences: DEFAULT_USER_PREFERENCES,
  },
};

// State reducer
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        search: {
          ...state.search,
          query: action.payload,
          status: 'searching',
          error: null,
        },
      };

    case 'SET_SEARCH_STATUS':
      return {
        ...state,
        search: {
          ...state.search,
          status: action.payload,
        },
      };

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        search: {
          ...state.search,
          results: action.payload,
          status: 'complete',
          error: null,
        },
      };

    case 'SET_SEARCH_ERROR':
      return {
        ...state,
        search: {
          ...state.search,
          error: action.payload,
          status: action.payload ? 'error' : state.search.status,
        },
      };

    case 'CLEAR_SEARCH':
      return {
        ...state,
        search: {
          query: null,
          results: [],
          status: 'idle',
          error: null,
        },
        ui: {
          ...state.ui,
          selectedResult: null,
          cardPosition: 0,
        },
      };

    case 'SET_SELECTED_RESULT':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedResult: action.payload,
        },
      };

    case 'SET_CARD_POSITION':
      return {
        ...state,
        ui: {
          ...state.ui,
          cardPosition: action.payload,
        },
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        ui: {
          ...state.ui,
          viewMode: action.payload,
        },
      };

    case 'SET_THEME':
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: action.payload,
        },
      };

    case 'SET_ACTIVE_PROVIDER':
      return {
        ...state,
        configuration: {
          ...state.configuration,
          activeProvider: action.payload,
        },
      };

    case 'SET_ACTIVE_MODEL':
      return {
        ...state,
        configuration: {
          ...state.configuration,
          activeModel: action.payload,
        },
      };

    case 'SET_PREFERENCES':
      return {
        ...state,
        configuration: {
          ...state.configuration,
          preferences: action.payload,
        },
        ui: {
          ...state.ui,
          theme: action.payload.theme,
        },
      };

    case 'UPDATE_PREFERENCE':
      const newPreferences = {
        ...state.configuration.preferences,
        [action.payload.key]: action.payload.value,
      };
      
      return {
        ...state,
        configuration: {
          ...state.configuration,
          preferences: newPreferences,
        },
        ui: {
          ...state.ui,
          theme: action.payload.key === 'theme' ? action.payload.value : state.ui.theme,
        },
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// Context types
interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Search actions
  setSearchQuery: (query: SearchQuery) => void;
  setSearchStatus: (status: AppState['search']['status']) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchError: (error: string | null) => void;
  clearSearch: () => void;
  
  // UI actions
  setSelectedResult: (id: string | null) => void;
  setCardPosition: (position: number) => void;
  setViewMode: (mode: AppState['ui']['viewMode']) => void;
  setTheme: (theme: AppState['ui']['theme']) => void;
  
  // Configuration actions
  setActiveProvider: (provider: string) => void;
  setActiveModel: (model: string) => void;
  updatePreference: (key: keyof UserPreferences, value: any) => void;
  
  // Computed values
  isSearching: boolean;
  hasResults: boolean;
  selectedResultData: SearchResult | null;
  currentResultIndex: number;
}

// Create context
const AppStateContext = createContext<AppStateContextType | null>(null);

// Provider component
export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // Load persisted preferences on mount
  useEffect(() => {
    const savedPreferences = PreferencesStorage.getPreferences();
    if (savedPreferences) {
      dispatch({ type: 'SET_PREFERENCES', payload: savedPreferences });
    }
  }, []);

  // Persist preferences when they change
  useEffect(() => {
    PreferencesStorage.setPreferences(state.configuration.preferences);
  }, [state.configuration.preferences]);

  // Search actions
  const setSearchQuery = useCallback((query: SearchQuery) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const setSearchStatus = useCallback((status: AppState['search']['status']) => {
    dispatch({ type: 'SET_SEARCH_STATUS', payload: status });
  }, []);

  const setSearchResults = useCallback((results: SearchResult[]) => {
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
  }, []);

  const setSearchError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_SEARCH_ERROR', payload: error });
  }, []);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, []);

  // UI actions
  const setSelectedResult = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_RESULT', payload: id });
  }, []);

  const setCardPosition = useCallback((position: number) => {
    dispatch({ type: 'SET_CARD_POSITION', payload: position });
  }, []);

  const setViewMode = useCallback((mode: AppState['ui']['viewMode']) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const setTheme = useCallback((theme: AppState['ui']['theme']) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  // Configuration actions
  const setActiveProvider = useCallback((provider: string) => {
    dispatch({ type: 'SET_ACTIVE_PROVIDER', payload: provider });
  }, []);

  const setActiveModel = useCallback((model: string) => {
    dispatch({ type: 'SET_ACTIVE_MODEL', payload: model });
  }, []);

  const updatePreference = useCallback((key: keyof UserPreferences, value: any) => {
    dispatch({ type: 'UPDATE_PREFERENCE', payload: { key, value } });
  }, []);

  // Computed values
  const isSearching = useMemo(() => 
    state.search.status === 'searching' || state.search.status === 'analyzing',
    [state.search.status]
  );

  const hasResults = useMemo(() => 
    state.search.results.length > 0,
    [state.search.results.length]
  );

  const selectedResultData = useMemo(() => 
    state.ui.selectedResult 
      ? state.search.results.find(result => result.id === state.ui.selectedResult) || null
      : null,
    [state.ui.selectedResult, state.search.results]
  );

  const currentResultIndex = useMemo(() => 
    state.ui.selectedResult 
      ? state.search.results.findIndex(result => result.id === state.ui.selectedResult)
      : -1,
    [state.ui.selectedResult, state.search.results]
  );

  // Context value
  const contextValue: AppStateContextType = {
    state,
    dispatch,
    
    // Search actions
    setSearchQuery,
    setSearchStatus,
    setSearchResults,
    setSearchError,
    clearSearch,
    
    // UI actions
    setSelectedResult,
    setCardPosition,
    setViewMode,
    setTheme,
    
    // Configuration actions
    setActiveProvider,
    setActiveModel,
    updatePreference,
    
    // Computed values
    isSearching,
    hasResults,
    selectedResultData,
    currentResultIndex,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook to use app state
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// Selector hooks for specific state slices
export const useSearchState = () => {
  const { state } = useAppState();
  return state.search;
};

export const useUIState = () => {
  const { state } = useAppState();
  return state.ui;
};

export const useConfigurationState = () => {
  const { state } = useAppState();
  return state.configuration;
};

// Action hooks for specific domains
export const useSearchActions = () => {
  const { setSearchQuery, setSearchStatus, setSearchResults, setSearchError, clearSearch } = useAppState();
  return { setSearchQuery, setSearchStatus, setSearchResults, setSearchError, clearSearch };
};

export const useUIActions = () => {
  const { setSelectedResult, setCardPosition, setViewMode, setTheme } = useAppState();
  return { setSelectedResult, setCardPosition, setViewMode, setTheme };
};

export const useConfigurationActions = () => {
  const { setActiveProvider, setActiveModel, updatePreference } = useAppState();
  return { setActiveProvider, setActiveModel, updatePreference };
};

// Computed state hooks
export const useComputedState = () => {
  const { isSearching, hasResults, selectedResultData, currentResultIndex } = useAppState();
  return { isSearching, hasResults, selectedResultData, currentResultIndex };
};

// Debug hook (development only)
export const useAppStateDebug = () => {
  const { state, dispatch } = useAppState();
  
  const debugActions = useMemo(() => ({
    logState: () => console.log('Current App State:', state),
    resetState: () => dispatch({ type: 'RESET_STATE' }),
    exportState: () => JSON.stringify(state, null, 2),
    importState: (stateJson: string) => {
      try {
        const importedState = JSON.parse(stateJson);
        // Validate and merge state here if needed
        console.log('State import not implemented in production');
      } catch (error) {
        console.error('Failed to import state:', error);
      }
    },
  }), [state, dispatch]);

  return debugActions;
};