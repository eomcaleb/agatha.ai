// Storage utilities for Agatha

import { STORAGE_KEYS } from '../constants';
import type { UserPreferences, LLMProvider } from '../types';

// Simple encryption/decryption for API keys (basic obfuscation)
function encryptApiKey(apiKey: string): string {
  return btoa(apiKey);
}

function decryptApiKey(encryptedKey: string): string {
  try {
    return atob(encryptedKey);
  } catch {
    return '';
  }
}

export class SecureStorage {
  static setApiKey(provider: string, apiKey: string): void {
    try {
      const keys = this.getApiKeys();
      keys[provider] = encryptApiKey(apiKey);
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to store API key:', error);
    }
  }

  static getApiKey(provider: string): string | null {
    try {
      const keys = this.getApiKeys();
      const encryptedKey = keys[provider];
      return encryptedKey ? decryptApiKey(encryptedKey) : null;
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  static removeApiKey(provider: string): void {
    try {
      const keys = this.getApiKeys();
      delete keys[provider];
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to remove API key:', error);
    }
  }

  static getApiKeys(): Record<string, string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to parse stored API keys:', error);
      return {};
    }
  }

  static clearAllApiKeys(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.API_KEYS);
    } catch (error) {
      console.error('Failed to clear API keys:', error);
    }
  }
}

export class PreferencesStorage {
  static setPreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to store preferences:', error);
    }
  }

  static getPreferences(): UserPreferences | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve preferences:', error);
      return null;
    }
  }

  static clearPreferences(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    } catch (error) {
      console.error('Failed to clear preferences:', error);
    }
  }
}

export class CacheStorage {
  static setSearchResults(query: string, results: any[], ttl: number = 300000): void { // 5 minutes default TTL
    try {
      const cacheData = {
        results,
        timestamp: Date.now(),
        ttl,
      };
      const cache = this.getCache();
      cache[query] = cacheData;
      localStorage.setItem(STORAGE_KEYS.CACHED_RESULTS, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache search results:', error);
    }
  }

  static getSearchResults(query: string): any[] | null {
    try {
      const cache = this.getCache();
      const cacheData = cache[query];
      
      if (!cacheData) {
        return null;
      }

      // Check if cache has expired
      if (Date.now() - cacheData.timestamp > cacheData.ttl) {
        delete cache[query];
        localStorage.setItem(STORAGE_KEYS.CACHED_RESULTS, JSON.stringify(cache));
        return null;
      }

      return cacheData.results;
    } catch (error) {
      console.error('Failed to retrieve cached results:', error);
      return null;
    }
  }

  static clearCache(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CACHED_RESULTS);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  private static getCache(): Record<string, any> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CACHED_RESULTS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to parse cache:', error);
      return {};
    }
  }
}

export class SearchHistoryStorage {
  static addSearch(query: string): void {
    try {
      const history = this.getHistory();
      const newEntry = {
        query,
        timestamp: Date.now(),
      };
      
      // Remove duplicate if exists
      const filtered = history.filter(entry => entry.query !== query);
      
      // Add to beginning and limit to 50 entries
      const updated = [newEntry, ...filtered].slice(0, 50);
      
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to add search to history:', error);
    }
  }

  static getHistory(): Array<{ query: string; timestamp: number }> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve search history:', error);
      return [];
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }
}