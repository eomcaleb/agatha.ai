import type { ToastProps } from '../components/Toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export interface ToastState {
  toasts: ToastProps[];
}

type ToastListener = (toasts: ToastProps[]) => void;

export class ToastService {
  private static instance: ToastService;
  private toasts: ToastProps[] = [];
  private listeners: Set<ToastListener> = new Set();
  private nextId = 1;

  private constructor() {}

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  /**
   * Add a toast notification
   */
  show(options: ToastOptions): string {
    const id = `toast-${this.nextId++}`;
    
    const toast: ToastProps = {
      id,
      type: options.type,
      title: options.title,
      ...(options.message !== undefined && { message: options.message }),
      duration: options.duration ?? this.getDefaultDuration(options.type),
      onDismiss: (toastId) => this.dismiss(toastId),
      ...(options.actions !== undefined && { actions: options.actions })
    };

    this.toasts.push(toast);
    this.notifyListeners();
    
    return id;
  }

  /**
   * Show a success toast
   */
  success(title: string, message?: string, duration?: number): string {
    const options: ToastOptions = {
      type: 'success',
      title,
      ...(message !== undefined && { message }),
      ...(duration !== undefined && { duration })
    };
    return this.show(options);
  }

  /**
   * Show an error toast
   */
  error(title: string, message?: string, duration?: number): string {
    const options: ToastOptions = {
      type: 'error',
      title,
      ...(message !== undefined && { message }),
      duration: duration ?? 0 // Errors are persistent by default
    };
    return this.show(options);
  }

  /**
   * Show a warning toast
   */
  warning(title: string, message?: string, duration?: number): string {
    const options: ToastOptions = {
      type: 'warning',
      title,
      ...(message !== undefined && { message }),
      ...(duration !== undefined && { duration })
    };
    return this.show(options);
  }

  /**
   * Show an info toast
   */
  info(title: string, message?: string, duration?: number): string {
    const options: ToastOptions = {
      type: 'info',
      title,
      ...(message !== undefined && { message }),
      ...(duration !== undefined && { duration })
    };
    return this.show(options);
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  /**
   * Dismiss all toasts of a specific type
   */
  dismissByType(type: ToastType): void {
    this.toasts = this.toasts.filter(toast => toast.type !== type);
    this.notifyListeners();
  }

  /**
   * Get all current toasts
   */
  getToasts(): ToastProps[] {
    return [...this.toasts];
  }

  /**
   * Subscribe to toast updates
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the default duration for a toast type
   */
  private getDefaultDuration(type: ToastType): number {
    switch (type) {
      case 'success':
        return 4000;
      case 'info':
        return 5000;
      case 'warning':
        return 6000;
      case 'error':
        return 0; // Persistent
      default:
        return 5000;
    }
  }

  /**
   * Notify all listeners of toast changes
   */
  private notifyListeners(): void {
    const toasts = this.getToasts();
    this.listeners.forEach(listener => {
      try {
        listener(toasts);
      } catch (error) {
        console.error('Error in toast listener:', error);
      }
    });
  }

  /**
   * Show a toast for search operations
   */
  showSearchStatus(status: 'started' | 'progress' | 'completed' | 'failed', details?: string): string {
    switch (status) {
      case 'started':
        return this.info('Search Started', 'Discovering relevant websites...', 3000);
      case 'progress':
        return this.info('Search in Progress', details || 'Analyzing content...', 2000);
      case 'completed':
        return this.success('Search Completed', details || 'Found relevant results');
      case 'failed':
        return this.error('Search Failed', details || 'Unable to complete search');
      default:
        return this.info('Search Update', details);
    }
  }

  /**
   * Show a toast for configuration operations
   */
  showConfigStatus(status: 'saved' | 'failed' | 'invalid', details?: string): string {
    switch (status) {
      case 'saved':
        return this.success('Settings Saved', details || 'Configuration updated successfully');
      case 'failed':
        return this.error('Save Failed', details || 'Unable to save configuration');
      case 'invalid':
        return this.warning('Invalid Configuration', details || 'Please check your settings');
      default:
        return this.info('Configuration Update', details);
    }
  }

  /**
   * Show a toast for API operations
   */
  showAPIStatus(status: 'connected' | 'failed' | 'rate_limited', provider?: string, details?: string): string {
    const providerName = provider ? ` (${provider})` : '';
    
    switch (status) {
      case 'connected':
        return this.success('API Connected', `Successfully connected to AI service${providerName}`);
      case 'failed':
        return this.error('API Error', details || `Failed to connect to AI service${providerName}`);
      case 'rate_limited':
        return this.warning('Rate Limited', `Too many requests to${providerName}. Please wait before trying again.`);
      default:
        return this.info('API Update', details);
    }
  }
}

// Global toast service instance
export const toastService = ToastService.getInstance();

// React hook for using toast service
export function useToast() {
  return toastService;
}