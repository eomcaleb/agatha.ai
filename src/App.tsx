// Main Application Component for Agatha

import React, { useCallback, useEffect } from 'react';
import { AppStateProvider, useAppState } from './hooks/useAppState';
import { useSearchWorkflow } from './hooks/useSearchWorkflow';
import { useToast } from './hooks/useToast';
import { SearchInput } from './components/SearchInput';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { HorizontalCardContainer } from './components/HorizontalCardContainer';
import { IframeViewer } from './components/IframeViewer';
import { LoadingSpinner, LoadingBar } from './components/LoadingSpinner';
import { StatusMessage, StatusIndicator } from './components/StatusMessage';
import { ToastContainer } from './components/Toast';
import type { SearchQuery } from './types';
import './App.css';

// Main App Content Component
const AppContent: React.FC = () => {
  const { state, hasResults, selectedResultData, setSelectedResult } = useAppState();
  const {
    executeSearch,
    cancelSearch,
    retrySearch,
    isSearching,
    isAnalyzing,
    progress,
    error,
    canCancel,
  } = useSearchWorkflow();
  const { toasts, showSearchStatus } = useToast();
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);

  // Handle search execution
  const handleSearch = useCallback(async (query: SearchQuery) => {
    try {
      showSearchStatus('started');
      await executeSearch(query, {
        autoAnalyze: state.configuration.preferences.autoAnalyze,
        useCache: true,
        maxConcurrentAnalysis: 3,
        timeout: 30000,
      });
      showSearchStatus('completed', `Found ${state.search.results.length} results`);
    } catch (error) {
      console.error('Search failed:', error);
      showSearchStatus('failed', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [executeSearch, state.configuration.preferences.autoAnalyze, showSearchStatus, state.search.results.length]);

  // Handle search cancellation
  const handleCancelSearch = useCallback(() => {
    cancelSearch();
  }, [cancelSearch]);

  // Handle search retry
  const handleRetrySearch = useCallback(() => {
    retrySearch();
  }, [retrySearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape to cancel search
      if (event.key === 'Escape' && canCancel) {
        handleCancelSearch();
      }
      
      // Ctrl/Cmd + R to retry search
      if ((event.ctrlKey || event.metaKey) && event.key === 'r' && error) {
        event.preventDefault();
        handleRetrySearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canCancel, error, handleCancelSearch, handleRetrySearch]);

  // Render loading state
  const renderLoadingState = () => {
    if (!isSearching && !isAnalyzing) return null;

    const loadingMessage = isSearching ? 'Searching for relevant websites...' : 'Analyzing content with AI...';
    const progressMessage = progress?.message || loadingMessage;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        margin: '20px 0',
      }}>
        <LoadingSpinner 
          size="large" 
          color="primary" 
          label={loadingMessage}
          className="mb-4"
        />
        
        <StatusMessage
          type="loading"
          message={isSearching ? 'Discovering Websites' : 'AI Analysis in Progress'}
          details={progressMessage}
          className="mb-4"
        />
        
        {progress && (
          <LoadingBar
            progress={progress.progress}
            size="medium"
            color="primary"
            label="Progress"
            showPercentage={true}
            className="w-full max-w-sm mb-4"
          />
        )}
        
        {canCancel && (
          <button
            onClick={handleCancelSearch}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Cancel Search
          </button>
        )}
      </div>
    );
  };

  // Render error state
  const renderErrorState = () => {
    if (!error) return null;

    return (
      <StatusMessage
        type="error"
        message="Search Failed"
        details={error}
        className="my-5"
        actions={[
          {
            label: 'Retry Search',
            onClick: handleRetrySearch,
            variant: 'primary'
          }
        ]}
      />
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (hasResults || isSearching || isAnalyzing || error) return null;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d',
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 16,
        }}>
          🔍
        </div>
        
        <div style={{
          fontSize: 24,
          fontWeight: 500,
          marginBottom: 8,
          color: '#333',
        }}>
          Welcome to Agatha
        </div>
        
        <div style={{
          fontSize: 16,
          maxWidth: 400,
          lineHeight: 1.5,
        }}>
          Enter a search query to discover and explore relevant websites with AI-powered analysis and ranking.
        </div>
      </div>
    );
  };

  // Render results
  const renderResults = () => {
    if (!hasResults || isSearching) return null;

    return (
      <div style={{ marginTop: 20 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '0 20px',
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 500,
            color: '#333',
          }}>
            Found {state.search.results.length} results
            {state.search.query && ` for "${state.search.query.prompt}"`}
          </div>
          
          {state.search.status === 'analyzing' && (
            <StatusIndicator
              status="loading"
              message="Analyzing results..."
            />
          )}
        </div>
        
        <HorizontalCardContainer 
          results={state.search.results}
          selectedId={state.ui.selectedResult}
          onResultSelect={setSelectedResult}
          onAnalyze={(id) => {
            // Handle individual result analysis
            console.log('Analyze result:', id);
          }}
        />
        
        {selectedResultData && (
          <div style={{ marginTop: 20 }}>
            <IframeViewer
              url={selectedResultData.url}
              title={selectedResultData.title}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: state.ui.theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
      color: state.ui.theme === 'dark' ? '#ffffff' : '#333333',
      transition: 'all 0.3s ease',
    }}>
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="skip-link"
        onFocus={(e) => e.currentTarget.style.top = '6px'}
        onBlur={(e) => e.currentTarget.style.top = '-40px'}
      >
        Skip to main content
      </a>

      {/* Header */}
      <header 
        role="banner"
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${state.ui.theme === 'dark' ? '#333' : '#e0e0e0'}`,
          backgroundColor: state.ui.theme === 'dark' ? '#2d2d2d' : '#ffffff',
        }}
      >
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <h1 style={{
            fontSize: 'clamp(20px, 4vw, 24px)',
            fontWeight: 700,
            color: '#007bff',
            margin: 0,
          }}>
            Agatha
          </h1>
          
          <button
            onClick={() => setIsConfigOpen(true)}
            aria-label="Open settings panel"
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              minHeight: '44px', // Accessibility: minimum touch target size
              minWidth: '44px',
            }}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main 
        id="main-content"
        role="main"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'clamp(16px, 4vw, 20px)',
        }}
      >
        {/* Search Input */}
        <div style={{ marginBottom: 20 }}>
          <SearchInput
            onSearch={handleSearch}
            isLoading={isSearching || isAnalyzing}
            placeholder="Search for websites and information..."
            autoFocus={true}
            showHistory={true}
            showSuggestions={true}
            maxResults={state.search.query?.maxResults || 10}
          />
        </div>

        {/* Content States */}
        {renderLoadingState()}
        {renderErrorState()}
        {renderEmptyState()}
        {renderResults()}
      </main>

      {/* Configuration Panel */}
      <ConfigurationPanel 
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer 
        toasts={toasts} 
        position="top-right"
      />

      {/* Global Styles */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          * {
            box-sizing: border-box;
          }
          
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* Enhanced focus styles for accessibility */
          *:focus {
            outline: 3px solid #007bff;
            outline-offset: 2px;
          }
          
          *:focus:not(:focus-visible) {
            outline: none;
          }
          
          *:focus-visible {
            outline: 3px solid #007bff;
            outline-offset: 2px;
          }
          
          button:focus,
          input:focus,
          select:focus,
          textarea:focus {
            outline: 3px solid #007bff;
            outline-offset: 2px;
          }
          
          /* Button interactions */
          button {
            transition: all 0.2s ease;
            cursor: pointer;
            min-height: 44px; /* Minimum touch target size */
            min-width: 44px;
          }
          
          button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          
          button:active:not(:disabled) {
            transform: translateY(0);
          }
          
          button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          /* Responsive breakpoints */
          @media (max-width: 1200px) {
            .desktop-hidden {
              display: none !important;
            }
            
            .tablet-stack {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            
            .tablet-full-width {
              width: 100% !important;
            }
          }
          
          @media (max-width: 768px) {
            .mobile-hidden {
              display: none !important;
            }
            
            .mobile-full-width {
              width: 100% !important;
            }
            
            .mobile-stack {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            
            .mobile-center {
              text-align: center !important;
            }
            
            /* Adjust padding for mobile */
            .mobile-padding {
              padding: 12px !important;
            }
            
            /* Larger touch targets on mobile */
            button {
              min-height: 48px;
              min-width: 48px;
              padding: 12px 16px;
            }
            
            /* Responsive text sizes */
            h1 {
              font-size: clamp(18px, 5vw, 24px) !important;
            }
            
            h2 {
              font-size: clamp(16px, 4vw, 20px) !important;
            }
            
            h3 {
              font-size: clamp(14px, 3.5vw, 18px) !important;
            }
          }
          
          @media (max-width: 480px) {
            .mobile-small-hidden {
              display: none !important;
            }
            
            .mobile-small-text {
              font-size: 14px !important;
            }
            
            .mobile-small-padding {
              padding: 8px !important;
            }
            
            /* Even larger touch targets on small screens */
            button {
              min-height: 52px;
              min-width: 52px;
              padding: 14px 18px;
            }
            
            /* Adjust container padding */
            .container {
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
          }
          
          /* High contrast mode support */
          @media (prefers-contrast: high) {
            button {
              border: 2px solid currentColor !important;
            }
            
            .card-content {
              border: 2px solid currentColor !important;
            }
            
            input, select, textarea {
              border: 2px solid currentColor !important;
            }
          }
          
          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
            
            .scroll-container {
              scroll-behavior: auto !important;
            }
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            :root {
              --bg-primary: #1a1a1a;
              --bg-secondary: #2d2d2d;
              --text-primary: #ffffff;
              --text-secondary: #cccccc;
              --border-color: #444444;
            }
          }
          
          /* Screen reader only content */
          .sr-only {
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
          }
          
          /* Skip link for keyboard navigation */
          .skip-link {
            position: absolute;
            top: -40px;
            left: 6px;
            background: #007bff;
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 10000;
          }
          
          .skip-link:focus {
            top: 6px;
          }
          
          /* Ensure interactive elements are keyboard accessible */
          [role="button"]:focus,
          [tabindex]:focus {
            outline: 3px solid #007bff;
            outline-offset: 2px;
          }
          
          /* Improve readability */
          p, li, div {
            line-height: 1.5;
          }
          
          /* Ensure sufficient color contrast */
          .text-muted {
            color: #6c757d !important;
          }
          
          @media (prefers-contrast: high) {
            .text-muted {
              color: #495057 !important;
            }
          }
        `}
      </style>
    </div>
  );
};

// Main App Component with Provider
const App: React.FC = () => {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
};

export default App;
