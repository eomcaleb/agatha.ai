// Search Input Component for Agatha

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SearchHistoryStorage } from '../utils/storage';
import { validateSearchQuery, sanitizeInput } from '../utils/validation';
import { ANIMATION_DURATIONS, DEFAULT_SEARCH_CONFIG } from '../constants';
import type { SearchQuery } from '../types';

export interface SearchInputProps {
  onSearch: (query: SearchQuery) => void;
  isLoading: boolean;
  placeholder?: string;
  initialQuery?: string;
  showHistory?: boolean;
  showSuggestions?: boolean;
  maxResults?: number;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
}

export interface SearchSuggestion {
  text: string;
  type: 'history' | 'suggestion' | 'completion';
  timestamp?: Date;
  frequency?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  isLoading,
  placeholder = 'Search for websites and information...',
  initialQuery = '',
  showHistory = true,
  showSuggestions = true,
  maxResults = DEFAULT_SEARCH_CONFIG.maxResults,
  autoFocus = false,
  className = '',
  disabled = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Memoized search history
  const searchHistory = useMemo(() => {
    if (!showHistory) return [];
    return SearchHistoryStorage.getHistory()
      .slice(0, 10) // Limit to recent 10 searches
      .map(entry => ({
        text: entry.query,
        type: 'history' as const,
        timestamp: new Date(entry.timestamp),
        frequency: 1,
      }));
  }, [showHistory]);

  // Generate search suggestions based on input
  const generateSuggestions = useCallback((input: string): SearchSuggestion[] => {
    if (!input.trim() || input.length < 2) {
      return showHistory ? searchHistory : [];
    }

    const lowerInput = input.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    // Add matching history items
    if (showHistory) {
      const matchingHistory = searchHistory.filter(item =>
        item.text.toLowerCase().includes(lowerInput)
      );
      suggestions.push(...matchingHistory);
    }

    // Add completion suggestions
    if (showSuggestions) {
      const completions = generateCompletions(input);
      suggestions.push(...completions);
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.text === suggestion.text)
    );

    return uniqueSuggestions.slice(0, 8); // Limit to 8 suggestions
  }, [searchHistory, showHistory, showSuggestions]);

  // Generate completion suggestions
  const generateCompletions = useCallback((input: string): SearchSuggestion[] => {
    const commonCompletions = [
      'how to',
      'what is',
      'best practices for',
      'tutorial for',
      'guide to',
      'examples of',
      'comparison between',
      'benefits of',
      'problems with',
      'alternatives to',
    ];

    return commonCompletions
      .filter(completion => 
        completion.startsWith(input.toLowerCase()) ||
        input.toLowerCase().includes(completion.split(' ')[0])
      )
      .map(completion => ({
        text: input.endsWith(' ') ? input + completion : completion + ' ' + input,
        type: 'completion' as const,
      }))
      .slice(0, 3);
  }, []);

  // Update suggestions with debouncing
  const updateSuggestions = useCallback((input: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const newSuggestions = generateSuggestions(input);
      setSuggestions(newSuggestions);
      setShowSuggestionsList(newSuggestions.length > 0 && document.activeElement === inputRef.current);
      setSelectedSuggestionIndex(-1);
    }, 150);
  }, [generateSuggestions]);

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (isComposing) return; // Skip during IME composition

    const value = event.target.value;
    setQuery(value);
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }

    // Update suggestions
    updateSuggestions(value);
  }, [isComposing, validationErrors.length, updateSuggestions]);

  // Handle form submission
  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    
    if (isLoading || disabled) return;

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Validate query
    const searchQuery: SearchQuery = {
      prompt: sanitizeInput(trimmedQuery),
      maxResults,
    };

    const errors = validateSearchQuery(searchQuery);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Hide suggestions
    setShowSuggestionsList(false);
    setSelectedSuggestionIndex(-1);

    // Execute search
    onSearch(searchQuery);

    // Add to search history
    SearchHistoryStorage.addSearch(trimmedQuery);
  }, [query, isLoading, disabled, maxResults, onSearch]);

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestionsList(false);
    setSelectedSuggestionIndex(-1);
    
    // Focus input and trigger search
    inputRef.current?.focus();
    
    // Trigger search after a brief delay to allow state update
    setTimeout(() => {
      const searchQuery: SearchQuery = {
        prompt: sanitizeInput(suggestion.text),
        maxResults,
      };
      onSearch(searchQuery);
      SearchHistoryStorage.addSearch(suggestion.text);
    }, 50);
  }, [maxResults, onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!showSuggestionsList || suggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          event.preventDefault();
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      
      case 'Escape':
        setShowSuggestionsList(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
      
      case 'Tab':
        if (selectedSuggestionIndex >= 0) {
          event.preventDefault();
          setQuery(suggestions[selectedSuggestionIndex].text);
          setShowSuggestionsList(false);
          setSelectedSuggestionIndex(-1);
        }
        break;
    }
  }, [showSuggestionsList, suggestions, selectedSuggestionIndex, selectSuggestion]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowSuggestionsList(true);
    } else {
      updateSuggestions(query);
    }
  }, [suggestions.length, updateSuggestions, query]);

  // Handle input blur
  const handleBlur = useCallback((event: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestionsList(false);
        setSelectedSuggestionIndex(-1);
      }
    }, 150);
  }, []);

  // Handle composition events (for IME input)
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback((event: React.CompositionEvent) => {
    setIsComposing(false);
    handleInputChange(event as any);
  }, [handleInputChange]);

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        suggestionsRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestionsList(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Format suggestion display text
  const formatSuggestionText = useCallback((suggestion: SearchSuggestion) => {
    const maxLength = 60;
    if (suggestion.text.length <= maxLength) {
      return suggestion.text;
    }
    return suggestion.text.substring(0, maxLength) + '...';
  }, []);

  // Get suggestion icon
  const getSuggestionIcon = useCallback((type: SearchSuggestion['type']) => {
    switch (type) {
      case 'history':
        return '🕒';
      case 'suggestion':
        return '💡';
      case 'completion':
        return '✨';
      default:
        return '🔍';
    }
  }, []);

  return (
    <div className={`search-input-container ${className}`} style={{ position: 'relative', width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%' }} role="search">
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'white',
            border: `2px solid ${validationErrors.length > 0 ? '#dc3545' : showSuggestionsList ? '#007bff' : '#e0e0e0'}`,
            borderRadius: 8,
            padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
            transition: `all ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
            boxShadow: showSuggestionsList ? '0 4px 12px rgba(0, 123, 255, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ marginRight: 12, color: '#6c757d', fontSize: 18 }}>
            🔍
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            aria-label="Search query input"
            aria-describedby={validationErrors.length > 0 ? 'search-errors' : showSuggestionsList ? 'search-suggestions' : undefined}
            aria-expanded={showSuggestionsList}
            aria-autocomplete="list"
            aria-activedescendant={selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined}
            role="combobox"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 'clamp(14px, 3vw, 16px)',
              backgroundColor: 'transparent',
              color: '#333',
            }}
            autoComplete="off"
            spellCheck="false"
          />
          
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setShowSuggestionsList(false);
                setValidationErrors([]);
                inputRef.current?.focus();
              }}
              style={{
                marginLeft: 8,
                padding: 4,
                border: 'none',
                backgroundColor: 'transparent',
                color: '#6c757d',
                cursor: 'pointer',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
          
          {isLoading && (
            <div
              style={{
                marginLeft: 8,
                width: 20,
                height: 20,
                border: '2px solid #e9ecef',
                borderTop: '2px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
          
          <button
            type="submit"
            disabled={disabled || isLoading || !query.trim()}
            style={{
              marginLeft: 12,
              padding: '8px 16px',
              backgroundColor: disabled || isLoading || !query.trim() ? '#e9ecef' : '#007bff',
              color: disabled || isLoading || !query.trim() ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: 6,
              cursor: disabled || isLoading || !query.trim() ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: `all ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          {validationErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestionsList && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            marginTop: 4,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            maxHeight: 300,
            overflowY: 'auto',
            animation: `fadeIn ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}-${index}`}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              onClick={() => selectSuggestion(suggestion)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }
              }}
              tabIndex={index === selectedSuggestionIndex ? 0 : -1}
              style={{
                padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
                cursor: 'pointer',
                backgroundColor: index === selectedSuggestionIndex ? '#f8f9fa' : 'transparent',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                transition: `background-color ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
                minHeight: '44px', // Minimum touch target size
              }}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <span style={{ marginRight: 12, fontSize: 16 }}>
                {getSuggestionIcon(suggestion.type)}
              </span>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#333' }}>
                  {formatSuggestionText(suggestion)}
                </div>
                
                {suggestion.type === 'history' && suggestion.timestamp && (
                  <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>
                    {suggestion.timestamp.toLocaleDateString()}
                  </div>
                )}
              </div>
              
              <div style={{ fontSize: 12, color: '#6c757d', textTransform: 'capitalize' }}>
                {suggestion.type}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSS Animations */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .search-input-container input::placeholder {
            color: #6c757d;
            opacity: 1;
          }
          
          .search-input-container button:hover:not(:disabled) {
            transform: translateY(-1px);
          }
          
          .search-input-container button:active:not(:disabled) {
            transform: translateY(0);
          }
        `}
      </style>
    </div>
  );
};