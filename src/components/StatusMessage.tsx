import React from 'react';

export type StatusType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface StatusMessageProps {
  type: StatusType;
  message: string;
  details?: string;
  className?: string;
  onDismiss?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  details,
  className = '',
  onDismiss,
  actions = []
}) => {
  const getStatusStyles = (type: StatusType) => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-50 border-green-200 text-green-800',
          icon: '✓',
          iconColor: 'text-green-600'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: '⚠',
          iconColor: 'text-yellow-600'
        };
      case 'error':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: '✕',
          iconColor: 'text-red-600'
        };
      case 'loading':
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: '⟳',
          iconColor: 'text-blue-600 animate-spin'
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'ℹ',
          iconColor: 'text-blue-600'
        };
    }
  };

  const styles = getStatusStyles(type);

  return (
    <div
      className={`
        status-message border rounded-lg p-4 flex items-start space-x-3
        ${styles.container}
        ${className}
      `}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className={`flex-shrink-0 ${styles.iconColor}`}>
        <span className="text-lg font-semibold" aria-hidden="true">
          {styles.icon}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium">{message}</p>
        {details && (
          <p className="mt-1 text-sm opacity-90">{details}</p>
        )}
        
        {actions.length > 0 && (
          <div className="mt-3 flex space-x-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`
                  px-3 py-1 text-sm font-medium rounded transition-colors
                  ${action.variant === 'primary'
                    ? 'bg-current text-white hover:opacity-90'
                    : 'border border-current hover:bg-current hover:text-white'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
          aria-label="Dismiss message"
        >
          <span className="text-lg" aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
};

export interface StatusIndicatorProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  className = ''
}) => {
  const getIndicatorStyles = (status: string) => {
    switch (status) {
      case 'loading':
        return {
          color: 'bg-blue-500',
          animation: 'animate-pulse'
        };
      case 'success':
        return {
          color: 'bg-green-500',
          animation: ''
        };
      case 'error':
        return {
          color: 'bg-red-500',
          animation: 'animate-pulse'
        };
      case 'idle':
      default:
        return {
          color: 'bg-gray-400',
          animation: ''
        };
    }
  };

  const styles = getIndicatorStyles(status);

  return (
    <div className={`status-indicator flex items-center space-x-2 ${className}`}>
      <div
        className={`w-2 h-2 rounded-full ${styles.color} ${styles.animation}`}
        role="status"
        aria-label={`Status: ${status}`}
      />
      {message && (
        <span className="text-sm text-gray-600">{message}</span>
      )}
    </div>
  );
};