type ActivityEventType = 'active' | 'inactive';
type ActivityCallback = (isActive: boolean, lastActivity: Date) => void;

export class UserActivityManager {
  private isActive = true;
  private lastActivity = new Date();
  private inactivityTimer: NodeJS.Timeout | null = null;
  private callbacks: ActivityCallback[] = [];
  private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];

  constructor() {
    this.setupEventListeners();
    this.resetInactivityTimer();
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return;

    const events = [
      // Mouse events
      { element: document, event: 'mousemove' },
      { element: document, event: 'mousedown' },
      { element: document, event: 'mouseup' },
      { element: document, event: 'click' },
      { element: document, event: 'wheel' },
      
      // Touch events (mobile)
      { element: document, event: 'touchstart' },
      { element: document, event: 'touchmove' },
      { element: document, event: 'touchend' },
      
      // Keyboard events
      { element: document, event: 'keydown' },
      { element: document, event: 'keyup' },
      
      // Window focus events
      { element: window, event: 'focus' },
      { element: document, event: 'visibilitychange' },
      
      // Page navigation
      { element: window, event: 'beforeunload' },
      { element: window, event: 'load' },
    ];

    events.forEach(({ element, event }) => {
      const handler = this.handleUserActivity.bind(this);
      element.addEventListener(event, handler, { passive: true });
      this.eventListeners.push({ element, event, handler });
    });

    // Handle route changes (for SPAs)
    if (window.history && window.history.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = (...args) => {
        this.handleUserActivity();
        return originalPushState.apply(window.history, args);
      };
    }

    console.log('🔔 UserActivityManager: Listening for user interactions');
  }

  private handleUserActivity = () => {
    const wasActive = this.isActive;
    this.isActive = true;
    this.lastActivity = new Date();
    this.resetInactivityTimer();

    // Only notify if state changed from inactive to active
    if (!wasActive) {
      console.log('👤 User became ACTIVE at', this.lastActivity.toLocaleTimeString());
      this.notifyCallbacks();
    }
  };

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      const wasActive = this.isActive;
      this.isActive = false;
      
      if (wasActive) {
        console.log('😴 User became INACTIVE after 5 minutes of no activity');
        this.notifyCallbacks();
      }
    }, this.INACTIVITY_TIMEOUT);
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => {
      try {
        callback(this.isActive, this.lastActivity);
      } catch (error) {
        console.error('Error in activity callback:', error);
      }
    });
  }

  // Public API
  public subscribe(callback: ActivityCallback): () => void {
    this.callbacks.push(callback);
    
    // Immediately call with current state
    callback(this.isActive, this.lastActivity);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  public getState() {
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      minutesSinceLastActivity: Math.floor((Date.now() - this.lastActivity.getTime()) / (1000 * 60))
    };
  }

  public forceActive() {
    this.handleUserActivity();
  }

  public cleanup() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    this.eventListeners = [];
    this.callbacks = [];
    
    console.log('🔕 UserActivityManager: Cleaned up all listeners');
  }
}

// Singleton instance
export const userActivityManager = new UserActivityManager();