// Validation utilities for Agatha

import type { SearchQuery, LLMProvider } from '../types';

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidApiKey(apiKey: string, provider: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Basic validation based on provider patterns
  switch (provider) {
    case 'anthropic':
      return apiKey.startsWith('sk-ant-');
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'gemini':
      return apiKey.length > 20; // Google API keys are typically longer
    case 'xai':
      return apiKey.startsWith('xai-');
    default:
      return apiKey.length > 10; // Basic length check for unknown providers
  }
}

export function validateSearchQuery(query: SearchQuery): string[] {
  const errors: string[] = [];

  if (!query.prompt || typeof query.prompt !== 'string') {
    errors.push('Search prompt is required');
  } else if (query.prompt.trim().length === 0) {
    errors.push('Search prompt cannot be empty');
  } else if (query.prompt.length > 1000) {
    errors.push('Search prompt is too long (max 1000 characters)');
  }

  if (typeof query.maxResults !== 'number' || query.maxResults < 1 || query.maxResults > 50) {
    errors.push('Max results must be between 1 and 50');
  }

  if (query.filters?.domains) {
    const invalidDomains = query.filters.domains.filter(domain => !isValidDomain(domain));
    if (invalidDomains.length > 0) {
      errors.push(`Invalid domains: ${invalidDomains.join(', ')}`);
    }
  }

  return errors;
}

export function validateProvider(provider: LLMProvider): string[] {
  const errors: string[] = [];

  if (!provider.name || typeof provider.name !== 'string') {
    errors.push('Provider name is required');
  }

  if (!provider.baseUrl || !isValidUrl(provider.baseUrl)) {
    errors.push('Valid base URL is required');
  }

  if (!Array.isArray(provider.models) || provider.models.length === 0) {
    errors.push('At least one model is required');
  }

  if (provider.apiKey && !isValidApiKey(provider.apiKey, provider.name.toLowerCase())) {
    errors.push('Invalid API key format');
  }

  if (typeof provider.rateLimit.requestsPerMinute !== 'number' || provider.rateLimit.requestsPerMinute < 1) {
    errors.push('Valid requests per minute rate limit is required');
  }

  if (typeof provider.rateLimit.tokensPerMinute !== 'number' || provider.rateLimit.tokensPerMinute < 1) {
    errors.push('Valid tokens per minute rate limit is required');
  }

  return errors;
}

function isValidDomain(domain: string): boolean {
  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, ''); // Remove data: protocol
}