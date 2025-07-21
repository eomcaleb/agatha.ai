import { ToastService, toastService } from '../toastService';
import { vi } from 'vitest';

// Mock timers for testing
vi.useFakeTimers();

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = ToastService.getInstance();
    service.dismissAll(); // Clear any existing toasts
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = ToastService.getInstance();
      const instance2 = ToastService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('global service is the same instance', () => {
      expect(toastService).toBe(ToastService.getInstance());
    });
  });

  describe('show method', () => {
    it('creates and returns toast ID', () => {
      const id = service.show({
        type: 'info',
        title: 'Test Toast'
      });

      expect(id).toMatch(/^toast-\d+$/);
      expect(service.getToasts()).toHaveLength(1);
    });

    it('creates toast with correct properties', () => {
      service.show({
        type: 'success',
        title: 'Success Message',
        message: 'Operation completed',
        duration: 3000
      });

      const toasts = service.getToasts();
      expect(toasts[0]).toMatchObject({
        type: 'success',
        title: 'Success Message',
        message: 'Operation completed',
        duration: 3000
      });
    });

    it('uses default duration when not specified', () => {
      service.show({
        type: 'info',
        title: 'Info Message'
      });

      const toasts = service.getToasts();
      expect(toasts[0].duration).toBe(5000); // Default for info
    });
  });

  describe('convenience methods', () => {
    it('success creates success toast', () => {
      const id = service.success('Success!', 'It worked');

      const toasts = service.getToasts();
      expect(toasts[0]).toMatchObject({
        type: 'success',
        title: 'Success!',
        message: 'It worked'
      });
      expect(id).toMatch(/^toast-\d+$/);
    });

    it('error creates persistent error toast', () => {
      service.error('Error!', 'Something went wrong');

      const toasts = service.getToasts();
      expect(toasts[0]).toMatchObject({
        type: 'error',
        title: 'Error!',
        message: 'Something went wrong',
        duration: 0 // Persistent
      });
    });

    it('warning creates warning toast', () => {
      service.warning('Warning!', 'Be careful');

      const toasts = service.getToasts();
      expect(toasts[0]).toMatchObject({
        type: 'warning',
        title: 'Warning!',
        message: 'Be careful'
      });
    });

    it('info creates info toast', () => {
      service.info('Info', 'Just so you know');

      const toasts = service.getToasts();
      expect(toasts[0]).toMatchObject({
        type: 'info',
        title: 'Info',
        message: 'Just so you know'
      });
    });
  });

  describe('dismiss methods', () => {
    beforeEach(() => {
      service.success('Toast 1');
      service.error('Toast 2');
      service.warning('Toast 3');
    });

    it('dismisses specific toast by ID', () => {
      const toasts = service.getToasts();
      const idToDismiss = toasts[1].id;

      service.dismiss(idToDismiss);

      const remainingToasts = service.getToasts();
      expect(remainingToasts).toHaveLength(2);
      expect(remainingToasts.find(t => t.id === idToDismiss)).toBeUndefined();
    });

    it('dismisses all toasts', () => {
      expect(service.getToasts()).toHaveLength(3);

      service.dismissAll();

      expect(service.getToasts()).toHaveLength(0);
    });

    it('dismisses toasts by type', () => {
      expect(service.getToasts()).toHaveLength(3);

      service.dismissByType('error');

      const remainingToasts = service.getToasts();
      expect(remainingToasts).toHaveLength(2);
      expect(remainingToasts.find(t => t.type === 'error')).toBeUndefined();
    });
  });

  describe('subscription system', () => {
    it('notifies listeners when toasts change', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      service.success('New toast');

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'success',
            title: 'New toast'
          })
        ])
      );

      unsubscribe();
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      service.success('New toast');

      expect(listener).not.toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.subscribe(errorListener);
      service.subscribe(goodListener);

      service.success('Test toast');

      expect(consoleSpy).toHaveBeenCalledWith('Error in toast listener:', expect.any(Error));
      expect(goodListener).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('specialized toast methods', () => {
    it('showSearchStatus creates appropriate toasts', () => {
      service.showSearchStatus('started');
      service.showSearchStatus('progress', 'Analyzing content...');
      service.showSearchStatus('completed', 'Found 5 results');
      service.showSearchStatus('failed', 'Network error');

      const toasts = service.getToasts();
      expect(toasts).toHaveLength(4);
      
      expect(toasts[0]).toMatchObject({
        type: 'info',
        title: 'Search Started'
      });
      
      expect(toasts[1]).toMatchObject({
        type: 'info',
        title: 'Search in Progress',
        message: 'Analyzing content...'
      });
      
      expect(toasts[2]).toMatchObject({
        type: 'success',
        title: 'Search Completed',
        message: 'Found 5 results'
      });
      
      expect(toasts[3]).toMatchObject({
        type: 'error',
        title: 'Search Failed',
        message: 'Network error'
      });
    });

    it('showConfigStatus creates appropriate toasts', () => {
      service.showConfigStatus('saved');
      service.showConfigStatus('failed', 'Invalid API key');
      service.showConfigStatus('invalid', 'Missing required field');

      const toasts = service.getToasts();
      expect(toasts).toHaveLength(3);
      
      expect(toasts[0]).toMatchObject({
        type: 'success',
        title: 'Settings Saved'
      });
      
      expect(toasts[1]).toMatchObject({
        type: 'error',
        title: 'Save Failed',
        message: 'Invalid API key'
      });
      
      expect(toasts[2]).toMatchObject({
        type: 'warning',
        title: 'Invalid Configuration',
        message: 'Missing required field'
      });
    });

    it('showAPIStatus creates appropriate toasts', () => {
      service.showAPIStatus('connected', 'OpenAI');
      service.showAPIStatus('failed', 'Anthropic', 'Authentication failed');
      service.showAPIStatus('rate_limited', 'OpenAI');

      const toasts = service.getToasts();
      expect(toasts).toHaveLength(3);
      
      expect(toasts[0]).toMatchObject({
        type: 'success',
        title: 'API Connected',
        message: 'Successfully connected to AI service (OpenAI)'
      });
      
      expect(toasts[1]).toMatchObject({
        type: 'error',
        title: 'API Error',
        message: 'Authentication failed'
      });
      
      expect(toasts[2]).toMatchObject({
        type: 'warning',
        title: 'Rate Limited',
        message: 'Too many requests to (OpenAI). Please wait before trying again.'
      });
    });
  });

  describe('default durations', () => {
    it('uses correct default durations for each type', () => {
      service.success('Success');
      service.info('Info');
      service.warning('Warning');
      service.error('Error');

      const toasts = service.getToasts();
      
      expect(toasts.find(t => t.type === 'success')?.duration).toBe(4000);
      expect(toasts.find(t => t.type === 'info')?.duration).toBe(5000);
      expect(toasts.find(t => t.type === 'warning')?.duration).toBe(6000);
      expect(toasts.find(t => t.type === 'error')?.duration).toBe(0);
    });
  });
});