// Tests for PopupBlocker Service

import { PopupBlockerService } from '../popupBlockerService';

// Mock constants
jest.mock('../../constants', () => ({
  POPUP_SELECTORS: [
    '.popup',
    '.modal',
    '.overlay',
    '[id*="popup"]',
    '[class*="modal"]',
  ],
}));

describe('PopupBlockerService', () => {
  let popupBlockerService: PopupBlockerService;
  let mockDocument: Document;

  beforeEach(() => {
    // Reset singleton instance
    (PopupBlockerService as any).instance = undefined;
    popupBlockerService = PopupBlockerService.getInstance();

    // Create mock document
    mockDocument = document.implementation.createHTMLDocument('Test');
    
    // Mock window.getComputedStyle
    global.getComputedStyle = jest.fn().mockReturnValue({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'static',
      zIndex: 'auto',
    });

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      right: 300,
      bottom: 200,
    });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    jest.clearAllMocks();
  });

  afterEach(() => {
    popupBlockerService.cleanup();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = PopupBlockerService.getInstance();
      const instance2 = PopupBlockerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('startBlocking', () => {
    it('should start blocking popups with default options', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      popupBlockerService.startBlocking(mockDocument);

      const stats = popupBlockerService.getStats();
      expect(stats.activeRules).toBeGreaterThan(0);
    });

    it('should set up mutation observer', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      const observeSpy = jest.spyOn(MutationObserver.prototype, 'observe');
      
      popupBlockerService.startBlocking(mockDocument);

      expect(observeSpy).toHaveBeenCalledWith(mockBody, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    });

    it('should stop existing blocking before starting new one', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
      
      // Start blocking twice
      popupBlockerService.startBlocking(mockDocument);
      popupBlockerService.startBlocking(mockDocument);

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('stopBlocking', () => {
    it('should stop mutation observer and clear intervals', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      popupBlockerService.startBlocking(mockDocument);
      popupBlockerService.stopBlocking(mockDocument);

      expect(disconnectSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should reset active rules count', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      popupBlockerService.startBlocking(mockDocument);
      popupBlockerService.stopBlocking(mockDocument);

      const stats = popupBlockerService.getStats();
      expect(stats.activeRules).toBe(0);
    });
  });

  describe('blockPopups', () => {
    it('should block elements matching popup selectors', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(1);
      expect(popup.style.display).toBe('none');
      expect(popup.hasAttribute('data-popup-blocked')).toBe(true);
    });

    it('should not block elements that are already hidden', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      popup.style.display = 'none';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      // Mock getComputedStyle to return hidden
      global.getComputedStyle = jest.fn().mockReturnValue({
        display: 'none',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
        zIndex: 'auto',
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(0);
      expect(popup.hasAttribute('data-popup-blocked')).toBe(false);
    });

    it('should not block elements that are too small', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      // Mock getBoundingClientRect to return small size
      popup.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 10,
        height: 10,
        top: 0,
        left: 0,
        right: 10,
        bottom: 10,
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(0);
      expect(popup.hasAttribute('data-popup-blocked')).toBe(false);
    });

    it('should not block already processed elements', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      popup.setAttribute('data-popup-blocked', 'true');
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(0);
    });

    it('should preserve important content when preserveContent is true', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('nav'); // Important semantic element
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      const blockedCount = popupBlockerService.blockPopups(mockDocument, {
        preserveContent: true,
      });

      expect(blockedCount).toBe(0);
      expect(popup.hasAttribute('data-popup-blocked')).toBe(false);
    });
  });

  describe('custom rules', () => {
    it('should apply custom popup rules', () => {
      const mockBody = mockDocument.createElement('body');
      const customPopup = mockDocument.createElement('div');
      customPopup.className = 'custom-popup';
      mockBody.appendChild(customPopup);
      mockDocument.body = mockBody;

      popupBlockerService.addCustomRule({
        selector: '.custom-popup',
        action: 'hide',
        priority: 1,
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(1);
      expect(customPopup.style.display).toBe('none');
    });

    it('should apply custom rules with conditions', () => {
      const mockBody = mockDocument.createElement('body');
      const popup1 = mockDocument.createElement('div');
      const popup2 = mockDocument.createElement('div');
      popup1.className = 'conditional-popup';
      popup1.textContent = 'block me';
      popup2.className = 'conditional-popup';
      popup2.textContent = 'keep me';
      mockBody.appendChild(popup1);
      mockBody.appendChild(popup2);
      mockDocument.body = mockBody;

      popupBlockerService.addCustomRule({
        selector: '.conditional-popup',
        action: 'hide',
        condition: (element) => element.textContent?.includes('block') || false,
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(1);
      expect(popup1.style.display).toBe('none');
      expect(popup2.style.display).not.toBe('none');
    });

    it('should apply custom actions', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'custom-action-popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      const customAction = jest.fn();

      popupBlockerService.addCustomRule({
        selector: '.custom-action-popup',
        action: 'custom',
        customAction,
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument);

      expect(blockedCount).toBe(1);
      expect(customAction).toHaveBeenCalledWith(popup);
    });

    it('should remove custom rules', () => {
      popupBlockerService.addCustomRule({
        selector: '.test-popup',
        action: 'hide',
      });

      const removed = popupBlockerService.removeCustomRule('.test-popup');
      expect(removed).toBe(true);

      const removedAgain = popupBlockerService.removeCustomRule('.test-popup');
      expect(removedAgain).toBe(false);
    });
  });

  describe('restorePopups', () => {
    it('should restore blocked popups', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      popup.style.display = 'block';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      // Block the popup
      popupBlockerService.blockPopups(mockDocument);
      expect(popup.style.display).toBe('none');

      // Restore the popup
      const restoredCount = popupBlockerService.restorePopups(mockDocument);
      expect(restoredCount).toBe(1);
      expect(popup.style.display).toBe('block');
      expect(popup.hasAttribute('data-popup-blocked')).toBe(false);
    });

    it('should restore specific popups by selector', () => {
      const mockBody = mockDocument.createElement('body');
      const popup1 = mockDocument.createElement('div');
      const popup2 = mockDocument.createElement('div');
      popup1.className = 'popup';
      popup2.className = 'modal';
      mockBody.appendChild(popup1);
      mockBody.appendChild(popup2);
      mockDocument.body = mockBody;

      // Block both popups
      popupBlockerService.blockPopups(mockDocument);

      // Restore only popup class
      const restoredCount = popupBlockerService.restorePopups(mockDocument, '.popup');
      expect(restoredCount).toBe(1);
      expect(popup1.hasAttribute('data-popup-blocked')).toBe(false);
      expect(popup2.hasAttribute('data-popup-blocked')).toBe(true);
    });
  });

  describe('aggressive mode', () => {
    it('should block high z-index elements in aggressive mode', () => {
      const mockBody = mockDocument.createElement('body');
      const highZPopup = mockDocument.createElement('div');
      mockBody.appendChild(highZPopup);
      mockDocument.body = mockBody;

      // Mock high z-index
      global.getComputedStyle = jest.fn().mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
        zIndex: '9999',
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument, {
        aggressiveMode: true,
      });

      expect(blockedCount).toBe(1);
      expect(highZPopup.hasAttribute('data-popup-blocked')).toBe(true);
    });

    it('should block large fixed elements in aggressive mode', () => {
      const mockBody = mockDocument.createElement('body');
      const largeFixed = mockDocument.createElement('div');
      mockBody.appendChild(largeFixed);
      mockDocument.body = mockBody;

      // Mock fixed position and large size
      global.getComputedStyle = jest.fn().mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'fixed',
        zIndex: 'auto',
      });

      largeFixed.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      });

      const blockedCount = popupBlockerService.blockPopups(mockDocument, {
        aggressiveMode: true,
      });

      expect(blockedCount).toBe(1);
      expect(largeFixed.hasAttribute('data-popup-blocked')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track blocking statistics', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      popupBlockerService.blockPopups(mockDocument);

      const stats = popupBlockerService.getStats();
      expect(stats.totalBlocked).toBe(1);
      expect(stats.byType['.popup']).toBe(1);
      expect(stats.lastBlocked).toBeInstanceOf(Date);
    });

    it('should reset statistics', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      popupBlockerService.blockPopups(mockDocument);
      popupBlockerService.resetStats();

      const stats = popupBlockerService.getStats();
      expect(stats.totalBlocked).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.lastBlocked).toBeNull();
    });
  });

  describe('blocked popups tracking', () => {
    it('should track blocked popups', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      popupBlockerService.blockPopups(mockDocument);

      const blockedPopups = popupBlockerService.getBlockedPopups(mockDocument);
      expect(blockedPopups).toHaveLength(1);
      expect(blockedPopups[0].element).toBe(popup);
      expect(blockedPopups[0].selector).toBe('.popup');
      expect(blockedPopups[0].action).toBe('hide');
    });

    it('should clear blocked popups history', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      popupBlockerService.blockPopups(mockDocument);
      popupBlockerService.clearHistory(mockDocument);

      const blockedPopups = popupBlockerService.getBlockedPopups(mockDocument);
      expect(blockedPopups).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', () => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      popupBlockerService.startBlocking(mockDocument);
      popupBlockerService.cleanup();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();

      const stats = popupBlockerService.getStats();
      expect(stats.totalBlocked).toBe(0);
    });
  });

  describe('close button detection', () => {
    it('should try to click close buttons when action is click', () => {
      const mockBody = mockDocument.createElement('body');
      const popup = mockDocument.createElement('div');
      const closeButton = mockDocument.createElement('button');
      closeButton.className = 'close';
      closeButton.click = jest.fn();
      popup.appendChild(closeButton);
      popup.className = 'popup';
      mockBody.appendChild(popup);
      mockDocument.body = mockBody;

      popupBlockerService.addCustomRule({
        selector: '.popup',
        action: 'click',
      });

      popupBlockerService.blockPopups(mockDocument);

      expect(closeButton.click).toHaveBeenCalled();
    });
  });

  describe('mutation observer', () => {
    it('should detect dynamically added popups', (done) => {
      const mockBody = mockDocument.createElement('body');
      mockDocument.body = mockBody;

      popupBlockerService.startBlocking(mockDocument);

      // Simulate adding a popup after a delay
      setTimeout(() => {
        const dynamicPopup = mockDocument.createElement('div');
        dynamicPopup.className = 'popup';
        mockBody.appendChild(dynamicPopup);

        // Trigger mutation observer
        const observer = (popupBlockerService as any).observers.get(mockDocument);
        if (observer) {
          observer.callback([{
            type: 'childList',
            addedNodes: [dynamicPopup],
          }]);
        }

        setTimeout(() => {
          expect(dynamicPopup.hasAttribute('data-popup-blocked')).toBe(true);
          done();
        }, 200);
      }, 100);
    });
  });
});