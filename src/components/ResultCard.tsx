// Result Card Component for Agatha

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CARD_DIMENSIONS, ANIMATION_DURATIONS } from '../constants';
import type { SearchResult } from '../types';

export interface ResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onBookmark?: (id: string) => void;
  className?: string;
  showActions?: boolean;
  showMetadata?: boolean;
  compact?: boolean;
}

export interface CardAction {
  id: string;
  label: string;
  icon: string;
  onClick: (resultId: string) => void;
  disabled?: boolean;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  result,
  isSelected,
  isCurrent = false,
  onSelect,
  onAnalyze,
  onBookmark,
  className = '',
  showActions = true,
  showMetadata = true,
  compact = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Generate preview image URL (placeholder implementation)
  const getPreviewImageUrl = useCallback((url: string): string => {
    // In a real implementation, this would use a service like:
    // - Screenshot API
    // - Website thumbnail service
    // - Cached preview images
    return `https://api.screenshotmachine.com/?key=demo&url=${encodeURIComponent(url)}&dimension=400x300`;
  }, []);

  // Handle card click
  const handleCardClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    onSelect(result.id);
  }, [onSelect, result.id]);

  // Handle action clicks
  const handleActionClick = useCallback((
    event: React.MouseEvent,
    action: () => void
  ) => {
    event.stopPropagation();
    setIsLoading(true);
    
    try {
      action();
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  }, []);

  // Handle analyze click
  const handleAnalyzeClick = useCallback((event: React.MouseEvent) => {
    if (onAnalyze) {
      handleActionClick(event, () => onAnalyze(result.id));
    }
  }, [onAnalyze, result.id, handleActionClick]);

  // Handle bookmark click
  const handleBookmarkClick = useCallback((event: React.MouseEvent) => {
    if (onBookmark) {
      handleActionClick(event, () => onBookmark(result.id));
    }
  }, [onBookmark, result.id, handleActionClick]);

  // Handle external link click
  const handleExternalLinkClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }, [result.url]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return timestamp.toLocaleDateString();
  }, []);

  // Get status color based on load status
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'loaded': return '#28a745';
      case 'loading': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  }, []);

  // Get relevance color based on score
  const getRelevanceColor = useCallback((score: number): string => {
    if (score >= 0.8) return '#28a745';
    if (score >= 0.6) return '#ffc107';
    if (score >= 0.4) return '#fd7e14';
    return '#dc3545';
  }, []);

  // Card dimensions based on compact mode
  const cardDimensions = {
    width: compact ? CARD_DIMENSIONS.WIDTH * 0.8 : CARD_DIMENSIONS.WIDTH,
    height: compact ? CARD_DIMENSIONS.HEIGHT * 0.8 : CARD_DIMENSIONS.HEIGHT,
  };

  // Card actions
  const actions: CardAction[] = [
    ...(onAnalyze ? [{
      id: 'analyze',
      label: 'Analyze',
      icon: '🔍',
      onClick: onAnalyze,
    }] : []),
    ...(onBookmark ? [{
      id: 'bookmark',
      label: 'Bookmark',
      icon: '🔖',
      onClick: onBookmark,
    }] : []),
    {
      id: 'external',
      label: 'Open',
      icon: '↗️',
      onClick: () => window.open(result.url, '_blank', 'noopener,noreferrer'),
    },
  ];

  return (
    <div
      ref={cardRef}
      className={`result-card ${className} ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''} ${compact ? 'compact' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: cardDimensions.width,
        height: cardDimensions.height,
        backgroundColor: 'white',
        borderRadius: CARD_DIMENSIONS.BORDER_RADIUS,
        boxShadow: isSelected 
          ? '0 8px 32px rgba(0, 123, 255, 0.3)' 
          : isHovered
            ? '0 8px 24px rgba(0, 0, 0, 0.15)'
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
        border: isSelected ? '2px solid #007bff' : '1px solid #e0e0e0',
        cursor: 'pointer',
        transition: `all ${ANIMATION_DURATIONS.CARD_TRANSITION}ms ease`,
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div
          className="loading-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: CARD_DIMENSIONS.BORDER_RADIUS,
          }}
        >
          <div
            className="spinner"
            style={{
              width: 24,
              height: 24,
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Status indicator */}
      <div
        className="status-indicator"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: getStatusColor(result.metadata.loadStatus),
          zIndex: 5,
        }}
        title={`Status: ${result.metadata.loadStatus}`}
      />

      {/* Preview image section */}
      {!compact && (
        <div
          className="card-preview"
          style={{
            height: 120,
            backgroundColor: '#f8f9fa',
            backgroundImage: !imageError ? `url(${getPreviewImageUrl(result.url)})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c757d',
            fontSize: 14,
            borderBottom: '1px solid #e0e0e0',
            position: 'relative',
          }}
        >
          {imageError && (
            <div className="preview-placeholder">
              <div style={{ fontSize: 24, marginBottom: 4 }}>🌐</div>
              <div>{result.metadata.domain}</div>
            </div>
          )}
          
          {/* Preview overlay on hover */}
          {isHovered && (
            <div
              className="preview-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 12,
                opacity: isHovered ? 1 : 0,
                transition: `opacity ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
              }}
            >
              Click to view
            </div>
          )}
          
          <img
            src={getPreviewImageUrl(result.url)}
            alt={`Preview of ${result.title}`}
            onError={() => setImageError(true)}
            style={{ display: 'none' }} // Hidden, used only for error detection
          />
        </div>
      )}

      {/* Card content */}
      <div
        className="card-content"
        style={{
          flex: 1,
          padding: compact ? 12 : 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="card-header" style={{ marginBottom: compact ? 8 : 12 }}>
          <h3
            style={{
              margin: 0,
              fontSize: compact ? 14 : 16,
              fontWeight: 600,
              color: '#333',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
            }}
            title={result.title}
          >
            {result.title}
          </h3>
          
          <div
            className="card-meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: compact ? 10 : 12,
              color: '#666',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={result.metadata.domain}
            >
              {result.metadata.domain}
            </span>
            
            {showMetadata && (
              <span style={{ marginLeft: 8, flexShrink: 0 }}>
                {formatTimestamp(result.timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          className="card-body"
          style={{
            flex: 1,
            marginBottom: compact ? 8 : 12,
            overflow: 'hidden',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: compact ? 12 : 14,
              color: '#555',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 4,
              WebkitBoxOrient: 'vertical',
            }}
            title={result.description}
          >
            {result.description}
          </p>
        </div>

        {/* Footer */}
        <div className="card-footer">
          {/* Scores */}
          {showMetadata && (
            <div
              className="card-scores"
              style={{
                display: 'flex',
                gap: compact ? 8 : 12,
                marginBottom: showActions ? 8 : 0,
                fontSize: compact ? 10 : 12,
              }}
            >
              <div
                className="relevance-score"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getRelevanceColor(result.relevanceScore),
                  }}
                />
                <span style={{ color: '#666' }}>
                  {Math.round(result.relevanceScore * 100)}% relevant
                </span>
              </div>
              
              <div
                className="confidence-score"
                style={{
                  color: '#888',
                }}
              >
                {Math.round(result.confidenceScore * 100)}% confidence
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && actions.length > 0 && (
            <div
              className="card-actions"
              style={{
                display: 'flex',
                gap: 8,
                opacity: isHovered || isSelected ? 1 : 0.7,
                transition: `opacity ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={(e) => handleActionClick(e, () => action.onClick(result.id))}
                  disabled={action.disabled || isLoading}
                  style={{
                    padding: compact ? '4px 6px' : '6px 8px',
                    fontSize: compact ? 10 : 11,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    backgroundColor: 'transparent',
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    color: action.disabled ? '#ccc' : '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: `all ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!action.disabled) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.borderColor = '#007bff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#ddd';
                  }}
                  title={action.label}
                >
                  <span>{action.icon}</span>
                  {!compact && <span>{action.label}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div
          className="selection-indicator"
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            border: '2px solid #007bff',
            borderRadius: CARD_DIMENSIONS.BORDER_RADIUS + 2,
            pointerEvents: 'none',
            animation: `pulse ${ANIMATION_DURATIONS.CARD_TRANSITION * 2}ms ease-in-out infinite alternate`,
          }}
        />
      )}

      {/* Keyboard focus indicator */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          .result-card:focus {
            outline: 2px solid #007bff;
            outline-offset: 2px;
          }
          
          .result-card:focus:not(:focus-visible) {
            outline: none;
          }
        `}
      </style>
    </div>
  );
};