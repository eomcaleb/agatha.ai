import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  className = '',
  label = 'Loading...'
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  return (
    <div 
      className={`loading-spinner ${className}`}
      role="status"
      aria-label={label}
    >
      <div
        className={`
          animate-spin rounded-full border-2
          ${sizeClasses[size]}
          ${colorClasses[color]}
        `}
      />
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
};

export interface LoadingDotsProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  label?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'medium',
  color = 'primary',
  className = '',
  label = 'Loading...'
}) => {
  const sizeClasses = {
    small: 'w-1 h-1',
    medium: 'w-2 h-2',
    large: 'w-3 h-3'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    white: 'bg-white'
  };

  return (
    <div 
      className={`loading-dots flex space-x-1 ${className}`}
      role="status"
      aria-label={label}
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`
            rounded-full animate-pulse
            ${sizeClasses[size]}
            ${colorClasses[color]}
          `}
          style={{
            animationDelay: `${index * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
};

export interface LoadingBarProps {
  progress?: number; // 0-100
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
  label?: string;
  showPercentage?: boolean;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({
  progress = 0,
  size = 'medium',
  color = 'primary',
  className = '',
  label = 'Loading...',
  showPercentage = false
}) => {
  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div 
      className={`loading-bar ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {showPercentage && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm text-gray-600">{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-300 ease-out ${colorClasses[color]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export interface PulsingSkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  rounded?: boolean;
}

export const PulsingSkeleton: React.FC<PulsingSkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = false
}) => {
  return (
    <div
      className={`
        animate-pulse bg-gray-300
        ${rounded ? 'rounded-full' : 'rounded'}
        ${className}
      `}
      style={{ width, height }}
      role="status"
      aria-label="Loading content..."
    />
  );
};