// Popup Blocker Service for Agatha

import { POPUP_SELECTORS } from '../constants';

export interface PopupBlockerOptions {
  selectors?: string[];
  checkInterval?: number;
  maxAttempts?: number;
  aggressiveMode?: boolean;
  preserveContent?: boolean;
  customRules?: PopupRule[];
}

export interface PopupRule {
  selector: string;
  action: 'hide' | 'remove' | 'click' | 'custom';
  condition?: (element: Element) => boolean;
  customAction?: (element: Element) => void;
  priority?: number;
}

export interface PopupBlockerStats {
  totalBlocked: number;
  byType: Record<string, number>;
  lastBlocked: Date | null;
  activeRules: number;
}

export interface BlockedPopup {
  element: Element;
  selector: string;
  timestamp: Date;
  action: string;
  restored?: boolean;
}

export class PopupBlockerService {
  private static instance: PopupBlockerService;
  private observers: Map<Document, MutationObserver> = new Map();
  private intervalIds: Map<Document, NodeJS.Timeout> = new Map();
  private blockedPopups: Map<Document, BlockedPopup[]> = new Map();
  private stats: PopupBlockerStats = {
    totalBlocked: 0,
    byType: {},
    lastBlocked: null,
    activeRules: 0,
  };

  private defaultOptions: Required<PopupBlockerOptions> = {
    selectors: POPUP_SELECTORS,
    checkInterval: 1000,
    maxAttempts: 10,
    aggressiveMode: false,
    preserveContent: true,
    customRules: [],
  };

  private constructor() {}

  static getInstance(): PopupBlockerService {
    if (!PopupBlockerService.instance) {
      PopupBlockerService.instance = new PopupBlockerService();
    }
    return PopupBlockerService.instance;
  }

  /**
   * Start blocking popups in the specified document
   */
  startBlocking(
    document: Document = window.document,
    options: PopupBlockerOptions = {}
  ): void {
    const config = { ...this.defaultOptions, ...options };
    
    // Stop any existing blocking for this document
    this.stopBlocking(document);

    // Initialize blocked popups array
    if (!this.blockedPopups.has(document)) {
      this.blockedPopups.set(document, []);
    }

    // Set up mutation observer for dynamic content
    this.setupMutationObserver(document, config);

    // Set up periodic checking
    this.setupPeriodicCheck(document, config);

    // Initial scan
    this.scanAndBlockPopups(document, config);

    this.stats.activeRules = config.selectors.length + config.customRules.length;
  }

  /**
   * Stop blocking popups in the specified document
   */
  stopBlocking(document: Document = window.document): void {
    // Disconnect mutation observer
    const observer = this.observers.get(document);
    if (observer) {
      observer.disconnect();
      this.observers.delete(document);
    }

    // Clear interval
    const intervalId = this.intervalIds.get(document);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(document);
    }

    this.stats.activeRules = 0;
  }

  /**
   * Manually block popups in the specified document
   */
  blockPopups(
    document: Document = window.document,
    options: PopupBlockerOptions = {}
  ): number {
    const config = { ...this.defaultOptions, ...options };
    return this.scanAndBlockPopups(document, config);
  }

  /**
   * Restore blocked popups
   */
  restorePopups(document: Document = window.document, selector?: string): number {
    const blockedPopups = this.blockedPopups.get(document) || [];
    let restoredCount = 0;

    blockedPopups.forEach(blocked => {
      if (!selector || blocked.selector === selector) {
        if (!blocked.restored) {
          this.restoreElement(blocked.element);
          blocked.restored = true;
          restoredCount++;
        }
      }
    });

    return restoredCount;
  }

  /**
   * Get blocking statistics
   */
  getStats(): PopupBlockerStats {
    return { ...this.stats };
  }

  /**
   * Get list of blocked popups for a document
   */
  getBlockedPopups(document: Document = window.document): BlockedPopup[] {
    return [...(this.blockedPopups.get(document) || [])];
  }

  /**
   * Clear blocked popups history
   */
  clearHistory(document: Document = window.document): void {
    this.blockedPopups.set(document, []);
  }

  /**
   * Add custom popup rule
   */
  addCustomRule(rule: PopupRule): void {
    this.defaultOptions.customRules.push(rule);
    this.defaultOptions.customRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Remove custom popup rule
   */
  removeCustomRule(selector: string): boolean {
    const index = this.defaultOptions.customRules.findIndex(rule => rule.selector === selector);
    if (index !== -1) {
      this.defaultOptions.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Setup mutation observer for dynamic content
   */
  private setupMutationObserver(document: Document, config: Required<PopupBlockerOptions>): void {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes might be popups
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (this.couldBePopup(element, config)) {
                shouldCheck = true;
              }
            }
          });
        }
      });

      if (shouldCheck) {
        // Debounce the check to avoid excessive scanning
        setTimeout(() => this.scanAndBlockPopups(document, config), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    this.observers.set(document, observer);
  }

  /**
   * Setup periodic checking for popups
   */
  private setupPeriodicCheck(document: Document, config: Required<PopupBlockerOptions>): void {
    let attempts = 0;
    
    const intervalId = setInterval(() => {
      const blockedCount = this.scanAndBlockPopups(document, config);
      
      attempts++;
      
      // Stop periodic checking after max attempts if no popups found recently
      if (attempts >= config.maxAttempts && blockedCount === 0) {
        clearInterval(intervalId);
        this.intervalIds.delete(document);
      }
    }, config.checkInterval);

    this.intervalIds.set(document, intervalId);
  }

  /**
   * Scan document and block popups
   */
  private scanAndBlockPopups(document: Document, config: Required<PopupBlockerOptions>): number {
    let blockedCount = 0;

    // Apply default selectors
    config.selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.shouldBlockElement(element, config)) {
            this.blockElement(element, selector, 'hide', document);
            blockedCount++;
          }
        });
      } catch (error) {
        console.warn(`Invalid popup selector: ${selector}`, error);
      }
    });

    // Apply custom rules
    config.customRules.forEach(rule => {
      try {
        const elements = document.querySelectorAll(rule.selector);
        elements.forEach(element => {
          if (!rule.condition || rule.condition(element)) {
            if (this.shouldBlockElement(element, config)) {
              this.blockElement(element, rule.selector, rule.action, document, rule.customAction);
              blockedCount++;
            }
          }
        });
      } catch (error) {
        console.warn(`Error applying custom rule: ${rule.selector}`, error);
      }
    });

    // Aggressive mode: additional heuristics
    if (config.aggressiveMode) {
      blockedCount += this.applyAggressiveBlocking(document, config);
    }

    return blockedCount;
  }

  /**
   * Check if element could be a popup based on quick heuristics
   */
  private couldBePopup(element: Element, config: Required<PopupBlockerOptions>): boolean {
    const style = window.getComputedStyle(element);
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toString().toLowerCase();
    const id = element.id.toLowerCase();

    // Check for common popup indicators
    return (
      style.position === 'fixed' ||
      style.position === 'absolute' ||
      style.zIndex === '9999' ||
      parseInt(style.zIndex) > 1000 ||
      className.includes('popup') ||
      className.includes('modal') ||
      className.includes('overlay') ||
      id.includes('popup') ||
      id.includes('modal') ||
      tagName === 'dialog'
    );
  }

  /**
   * Check if element should be blocked
   */
  private shouldBlockElement(element: Element, config: Required<PopupBlockerOptions>): boolean {
    // Skip if already processed
    if (element.hasAttribute('data-popup-blocked')) {
      return false;
    }

    // Skip if element is not visible
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    // Skip if element is too small (likely not a popup)
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      return false;
    }

    // Skip if element contains important content (when preserveContent is true)
    if (config.preserveContent && this.containsImportantContent(element)) {
      return false;
    }

    return true;
  }

  /**
   * Block an element using the specified action
   */
  private blockElement(
    element: Element,
    selector: string,
    action: string,
    document: Document,
    customAction?: (element: Element) => void
  ): void {
    // Mark as processed
    element.setAttribute('data-popup-blocked', 'true');
    element.setAttribute('data-popup-selector', selector);

    // Store original state for potential restoration
    const originalDisplay = (element as HTMLElement).style.display;
    const originalVisibility = (element as HTMLElement).style.visibility;
    element.setAttribute('data-popup-original-display', originalDisplay);
    element.setAttribute('data-popup-original-visibility', originalVisibility);

    // Apply blocking action
    switch (action) {
      case 'hide':
        (element as HTMLElement).style.display = 'none';
        break;
      case 'remove':
        element.remove();
        break;
      case 'click':
        // Try to find and click close button
        this.clickCloseButton(element);
        break;
      case 'custom':
        if (customAction) {
          customAction(element);
        }
        break;
    }

    // Record the blocked popup
    const blockedPopups = this.blockedPopups.get(document) || [];
    blockedPopups.push({
      element,
      selector,
      timestamp: new Date(),
      action,
    });
    this.blockedPopups.set(document, blockedPopups);

    // Update statistics
    this.stats.totalBlocked++;
    this.stats.byType[selector] = (this.stats.byType[selector] || 0) + 1;
    this.stats.lastBlocked = new Date();

    console.debug(`Blocked popup: ${selector}`, element);
  }

  /**
   * Restore a blocked element
   */
  private restoreElement(element: Element): void {
    if (!element.hasAttribute('data-popup-blocked')) {
      return;
    }

    const originalDisplay = element.getAttribute('data-popup-original-display') || '';
    const originalVisibility = element.getAttribute('data-popup-original-visibility') || '';

    (element as HTMLElement).style.display = originalDisplay;
    (element as HTMLElement).style.visibility = originalVisibility;

    element.removeAttribute('data-popup-blocked');
    element.removeAttribute('data-popup-selector');
    element.removeAttribute('data-popup-original-display');
    element.removeAttribute('data-popup-original-visibility');
  }

  /**
   * Try to click close button on popup
   */
  private clickCloseButton(element: Element): void {
    const closeSelectors = [
      '.close',
      '.close-button',
      '.modal-close',
      '.popup-close',
      '[aria-label*="close"]',
      '[title*="close"]',
      'button[class*="close"]',
      '.fa-times',
      '.fa-close',
      '.icon-close',
    ];

    for (const selector of closeSelectors) {
      const closeButton = element.querySelector(selector) as HTMLElement;
      if (closeButton) {
        try {
          closeButton.click();
          return;
        } catch (error) {
          console.warn('Failed to click close button:', error);
        }
      }
    }

    // Fallback: hide the element
    (element as HTMLElement).style.display = 'none';
  }

  /**
   * Check if element contains important content
   */
  private containsImportantContent(element: Element): boolean {
    const text = element.textContent || '';
    const importantKeywords = [
      'main content',
      'article',
      'navigation',
      'menu',
      'search',
      'login',
      'register',
      'checkout',
      'cart',
    ];

    // Check for important ARIA roles
    const role = element.getAttribute('role');
    if (role && ['main', 'navigation', 'search', 'form'].includes(role)) {
      return true;
    }

    // Check for important semantic elements
    const tagName = element.tagName.toLowerCase();
    if (['main', 'nav', 'article', 'section', 'form'].includes(tagName)) {
      return true;
    }

    // Check for important keywords in text content
    const lowerText = text.toLowerCase();
    return importantKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Apply aggressive blocking heuristics
   */
  private applyAggressiveBlocking(document: Document, config: Required<PopupBlockerOptions>): number {
    let blockedCount = 0;

    // Block elements with high z-index
    const highZIndexElements = document.querySelectorAll('*');
    highZIndexElements.forEach(element => {
      const style = window.getComputedStyle(element);
      const zIndex = parseInt(style.zIndex);
      
      if (zIndex > 1000 && this.shouldBlockElement(element, config)) {
        this.blockElement(element, 'high-z-index', 'hide', document);
        blockedCount++;
      }
    });

    // Block fixed positioned elements that cover significant screen area
    const fixedElements = document.querySelectorAll('*');
    fixedElements.forEach(element => {
      const style = window.getComputedStyle(element);
      if (style.position === 'fixed') {
        const rect = element.getBoundingClientRect();
        const screenArea = window.innerWidth * window.innerHeight;
        const elementArea = rect.width * rect.height;
        
        // If element covers more than 25% of screen
        if (elementArea > screenArea * 0.25 && this.shouldBlockElement(element, config)) {
          this.blockElement(element, 'large-fixed', 'hide', document);
          blockedCount++;
        }
      }
    });

    return blockedCount;
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalBlocked: 0,
      byType: {},
      lastBlocked: null,
      activeRules: this.stats.activeRules,
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Stop all blocking
    this.observers.forEach((observer, document) => {
      this.stopBlocking(document);
    });

    // Clear all data
    this.observers.clear();
    this.intervalIds.clear();
    this.blockedPopups.clear();
    this.resetStats();
  }
}