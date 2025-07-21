import { useState, useEffect } from 'react';
import { toastService, ToastService } from '../services/toastService';
import type { ToastProps } from '../components/Toast';

export interface UseToastReturn {
  toasts: ToastProps[];
  show: ToastService['show'];
  success: ToastService['success'];
  error: ToastService['error'];
  warning: ToastService['warning'];
  info: ToastService['info'];
  dismiss: ToastService['dismiss'];
  dismissAll: ToastService['dismissAll'];
  dismissByType: ToastService['dismissByType'];
  showSearchStatus: ToastService['showSearchStatus'];
  showConfigStatus: ToastService['showConfigStatus'];
  showAPIStatus: ToastService['showAPIStatus'];
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    // Subscribe to toast updates
    const unsubscribe = toastService.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });

    // Initialize with current toasts
    setToasts(toastService.getToasts());

    return unsubscribe;
  }, []);

  return {
    toasts,
    show: toastService.show.bind(toastService),
    success: toastService.success.bind(toastService),
    error: toastService.error.bind(toastService),
    warning: toastService.warning.bind(toastService),
    info: toastService.info.bind(toastService),
    dismiss: toastService.dismiss.bind(toastService),
    dismissAll: toastService.dismissAll.bind(toastService),
    dismissByType: toastService.dismissByType.bind(toastService),
    showSearchStatus: toastService.showSearchStatus.bind(toastService),
    showConfigStatus: toastService.showConfigStatus.bind(toastService),
    showAPIStatus: toastService.showAPIStatus.bind(toastService)
  };
}