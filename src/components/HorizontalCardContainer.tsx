// Horizontal Card Container Component for Agatha

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CARD_DIMENSIONS, ANIMATION_DURATIONS, BREAKPOINTS } from '../constants';
import type { SearchResult } from '../types';

export interface HorizontalCardContainerProps {
  results: SearchResult[];
  selectedId: string | null;
  onResultSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
  className?: string;
  autoScroll?: boolean;
  showNavigation?: boolean;
}

export interface CardPosition {
  index: number;
  x: number;
  isVisible: boolean;
  scale: number;
  opacity: number;
}

export const HorizontalCardContainer: React.FC<HorizontalCardContainerProps> = ({
  results,
  selectedId,
  onResultSelect,
  onAnalyze,
  className = '',
  autoScroll = true,
  showNavigation = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [cardPositions, setCardPositions] = useState<CardPosition[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });

  // Calculate responsive card dimensions
  const getCardDimensions = useCallback(() => {
    const baseWidth = CARD_DIMENSIONS.WIDTH;
    const baseHeight = CARD_DIMENSIONS.HEIGHT;
    
    if (isMobile) {
      return {
        width: Math.min(baseWidth * 0.8, containerWidth - 40),
        height: baseHeight * 0.8,
        margin: CARD_DIMENSIONS.MARGIN * 0.5,
      };
    }
    
    return {
      width: baseWidth,
      height: baseHeight,
      margin: CARD_DIMENSIONS.MARGIN,
    };
  }, [isMobile, containerWidth]);

  // Update container width and mobile state
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
      setIsMobile(window.innerWidth <= BREAKPOINTS.MOBILE);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate card positions for smooth scrolling effect
  useEffect(() => {
    const cardDims = getCardDimensions();
    const cardWidth = cardDims.width + cardDims.margin;
    const visibleCards = Math.floor(containerWidth / cardWidth) + 2; // Extra cards for smooth scrolling

    const positions: CardPosition[] = results.map((_, index) => {
      const x = index * cardWidth;
      const distanceFromCenter = Math.abs(index - currentIndex);
      const isVisible = distanceFromCenter <= visibleCards;
      
      // Scale and opacity based on distance from current card
      let scale = 1;
      let opacity = 1;
      
      if (distanceFromCenter > 0) {
        scale = Math.max(0.8, 1 - (distanceFromCenter * 0.1));
        opacity = Math.max(0.6, 1 - (distanceFromCenter * 0.2));
      }

      return {
        index,
        x,
        isVisible,
        scale,
        opacity,
      };
    });

    setCardPositions(positions);
  }, [results, currentIndex, containerWidth, getCardDimensions]);

  // Auto-scroll to selected card
  useEffect(() => {
    if (selectedId && autoScroll) {
      const selectedIndex = results.findIndex(result => result.id === selectedId);
      if (selectedIndex !== -1 && selectedIndex !== currentIndex) {
        scrollToIndex(selectedIndex);
      }
    }
  }, [selectedId, results, autoScroll, currentIndex]);

  // Smooth scroll to specific index
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!scrollContainerRef.current || index < 0 || index >= results.length) return;

    const cardDims = getCardDimensions();
    const cardWidth = cardDims.width + cardDims.margin;
    const targetX = index * cardWidth;
    const containerCenter = containerWidth / 2;
    const scrollLeft = targetX - containerCenter + (cardDims.width / 2);

    setIsScrolling(true);
    setCurrentIndex(index);

    if (smooth) {
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth',
      });

      setTimeout(() => setIsScrolling(false), ANIMATION_DURATIONS.SCROLL_SMOOTH);
    } else {
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollLeft);
      setIsScrolling(false);
    }
  }, [results.length, getCardDimensions, containerWidth]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (isScrolling || isDragging) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const cardDims = getCardDimensions();
    const cardWidth = cardDims.width + cardDims.margin;
    const scrollLeft = scrollContainer.scrollLeft;
    const containerCenter = containerWidth / 2;
    
    // Calculate which card is closest to center
    const centerPosition = scrollLeft + containerCenter;
    const newIndex = Math.round(centerPosition / cardWidth);
    const clampedIndex = Math.max(0, Math.min(newIndex, results.length - 1));

    if (clampedIndex !== currentIndex) {
      setCurrentIndex(clampedIndex);
    }
  }, [isScrolling, isDragging, getCardDimensions, containerWidth, results.length, currentIndex]);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  }, [currentIndex, scrollToIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < results.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  }, [currentIndex, results.length, scrollToIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return; // Only handle when not in input fields

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNext();
          break;
        case 'Enter':
        case ' ':
          if (results[currentIndex]) {
            event.preventDefault();
            onResultSelect(results[currentIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, results, goToPrevious, goToNext, onResultSelect]);

  // Touch/Mouse drag handling
  const handleDragStart = useCallback((clientX: number) => {
    if (!scrollContainerRef.current) return;
    
    setIsDragging(true);
    setDragStart({
      x: clientX,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    });
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !scrollContainerRef.current) return;

    const deltaX = clientX - dragStart.x;
    scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - deltaX;
  }, [isDragging, dragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    handleScroll(); // Snap to nearest card
  }, [handleScroll]);

  // Mouse events
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    handleDragStart(event.clientX);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    handleDragMove(event.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  // Touch events
  const handleTouchStart = (event: React.TouchEvent) => {
    handleDragStart(event.touches[0].clientX);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    handleDragMove(event.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Handle card click
  const handleCardClick = useCallback((result: SearchResult, index: number) => {
    if (index === currentIndex) {
      onResultSelect(result.id);
    } else {
      scrollToIndex(index);
    }
  }, [currentIndex, onResultSelect, scrollToIndex]);

  const cardDims = getCardDimensions();

  if (results.length === 0) {
    return (
      <div className={`horizontal-card-container empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>No results to display</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`horizontal-card-container ${className}`}
      role="region"
      aria-label={`Search results: ${results.length} items found`}
      style={{
        position: 'relative',
        width: '100%',
        height: cardDims.height + 60, // Extra space for navigation
        overflow: 'hidden',
      }}
    >
      {/* Navigation buttons */}
      {showNavigation && !isMobile && (
        <>
          <button
            className="nav-button nav-button-left"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            aria-label={`Go to previous result (${currentIndex} of ${results.length})`}
            title="Previous result"
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.3 : 1,
              transition: `opacity ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
              fontSize: '18px',
            }}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            className="nav-button nav-button-right"
            onClick={goToNext}
            disabled={currentIndex === results.length - 1}
            aria-label={`Go to next result (${currentIndex + 2} of ${results.length})`}
            title="Next result"
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              cursor: currentIndex === results.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === results.length - 1 ? 0.3 : 1,
              transition: `opacity ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
              fontSize: '18px',
            }}
          >
            <span aria-hidden="true">→</span>
          </button>
        </>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="scroll-container"
        role="listbox"
        aria-label="Search results"
        aria-activedescendant={`result-card-${results[currentIndex]?.id}`}
        tabIndex={0}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={isDragging ? handleMouseMove : undefined}
        onMouseUp={isDragging ? handleMouseUp : undefined}
        onMouseLeave={isDragging ? handleMouseUp : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={(e) => {
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault();
              goToPrevious();
              break;
            case 'ArrowRight':
              e.preventDefault();
              goToNext();
              break;
            case 'Enter':
            case ' ':
              if (results[currentIndex]) {
                e.preventDefault();
                onResultSelect(results[currentIndex].id);
              }
              break;
            case 'Home':
              e.preventDefault();
              scrollToIndex(0);
              break;
            case 'End':
              e.preventDefault();
              scrollToIndex(results.length - 1);
              break;
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          paddingLeft: containerWidth / 2 - cardDims.width / 2,
          paddingRight: containerWidth / 2 - cardDims.width / 2,
        }}
      >
        <div
          className="cards-track"
          style={{
            display: 'flex',
            height: '100%',
            width: results.length * (cardDims.width + cardDims.margin),
          }}
        >
          {results.map((result, index) => {
            const position = cardPositions[index];
            if (!position?.isVisible) return null;

            const isSelected = result.id === selectedId;
            const isCurrent = index === currentIndex;

            return (
              <div
                key={result.id}
                id={`result-card-${result.id}`}
                className={`card-wrapper ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
                role="option"
                aria-selected={isCurrent}
                aria-label={`Search result ${index + 1} of ${results.length}: ${result.title} from ${result.metadata.domain}. Relevance: ${Math.round(result.relevanceScore * 100)}%, Confidence: ${Math.round(result.confidenceScore * 100)}%`}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => handleCardClick(result, index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(result, index);
                  }
                }}
                style={{
                  width: cardDims.width,
                  height: cardDims.height,
                  marginRight: cardDims.margin,
                  transform: `scale(${position.scale})`,
                  opacity: position.opacity,
                  transition: isScrolling ? 'none' : `all ${ANIMATION_DURATIONS.CARD_TRANSITION}ms ease`,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  className="card-content"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'white',
                    borderRadius: CARD_DIMENSIONS.BORDER_RADIUS,
                    boxShadow: isCurrent 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
                      : '0 4px 16px rgba(0, 0, 0, 0.1)',
                    border: isSelected ? '2px solid #007bff' : '1px solid #e0e0e0',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: `all ${ANIMATION_DURATIONS.CARD_TRANSITION}ms ease`,
                  }}
                >
                  {/* Card header */}
                  <div className="card-header" style={{ marginBottom: 12 }}>
                    <h3 
                      style={{ 
                        margin: 0, 
                        fontSize: 16, 
                        fontWeight: 600,
                        color: '#333',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {result.title}
                    </h3>
                    <div 
                      style={{ 
                        fontSize: 12, 
                        color: '#666', 
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {result.metadata.domain}
                    </div>
                  </div>

                  {/* Card body */}
                  <div 
                    className="card-body" 
                    style={{ 
                      flex: 1, 
                      marginBottom: 12,
                      overflow: 'hidden',
                    }}
                  >
                    <p 
                      style={{ 
                        margin: 0, 
                        fontSize: 14, 
                        color: '#555',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {result.description}
                    </p>
                  </div>

                  {/* Card footer */}
                  <div className="card-footer">
                    <div 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: 12,
                        color: '#888',
                      }}
                    >
                      <div className="scores">
                        <span style={{ marginRight: 12 }}>
                          Relevance: {Math.round(result.relevanceScore * 100)}%
                        </span>
                        <span>
                          Confidence: {Math.round(result.confidenceScore * 100)}%
                        </span>
                      </div>
                      {onAnalyze && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnalyze(result.id);
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: 10,
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: '#666',
                          }}
                        >
                          Analyze
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress indicator */}
      {results.length > 1 && (
        <div 
          className="progress-indicator"
          role="tablist"
          aria-label="Result navigation"
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 4,
          }}
        >
          {results.map((result, index) => (
            <button
              key={index}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Go to result ${index + 1}: ${result.title}`}
              onClick={() => scrollToIndex(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  scrollToIndex(index);
                }
              }}
              style={{
                width: isMobile ? 12 : 8,
                height: isMobile ? 12 : 8,
                borderRadius: '50%',
                backgroundColor: index === currentIndex ? '#007bff' : '#ddd',
                border: 'none',
                cursor: 'pointer',
                transition: `all ${ANIMATION_DURATIONS.FADE_IN}ms ease`,
                minWidth: '44px',
                minHeight: '44px',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};