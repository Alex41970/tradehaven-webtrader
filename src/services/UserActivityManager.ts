type ActivityCallback = (isActive: boolean, lastActivity: Date) => void;

export class UserActivityManager {
  private isActive = true;
  private lastActivity = new Date();
  private inactivityTimer: NodeJS.Timeout | null = null;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private callbacks: ActivityCallback[] = [];
  private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly DISCONNECT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private isCompletelyDisconnected = false;
  
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];

  constructor() {
    this.setupEventListeners();
    this.setupPageUnloadDetection();
    this.resetInactivityTimer();
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return;

    const events = [
      { element: document, event: 'mousemove' },
      { element: document, event: 'mousedown' },
      { element: document, event: 'mouseup' },
      { element: document, event: 'click' },
      { element: document, event: 'wheel' },
      { element: document, event: 'touchstart' },
      { element: document, event: 'touchmove' },
      { element: document, event: 'touchend' },
      { element: document, event: 'keydown' },
      { element: document, event: 'keyup' },
      { element: window, event: 'focus' },
      { element: document, event: 'visibilitychange' },
      { element: window, event: 'beforeunload' },
      { element: window, event: 'load' },
    ];

    events.forEach(({ element, event }) => {
      const handler = this.handleUserActivity.bind(this);
      element.addEventListener(event, handler, { passive: true });
      this.eventListeners.push({ element, event, handler });
    });

    if (window.history && window.history.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = (...args) => {
        this.handleUserActivity();
        return originalPushState.apply(window.history, args);
      };
    }
  }

  private setupPageUnloadDetection() {
    if (typeof window === 'undefined') return;

    const handlePageUnload = () => {
      this.triggerCompleteDisconnect();
    };

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    
    this.eventListeners.push(
      { element: window, event: 'beforeunload', handler: handlePageUnload },
      { element: window, event: 'pagehide', handler: handlePageUnload }
    );
  }

  private handleUserActivity = () => {
    const wasActive = this.isActive;
    const wasDisconnected = this.isCompletelyDisconnected;
    
    this.isActive = true;
    this.isCompletelyDisconnected = false;
    this.lastActivity = new Date();
    this.resetInactivityTimer();

    if (!wasActive) {
      this.notifyCallbacks();
    }
  };

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      const wasActive = this.isActive;
      this.isActive = false;
      
      if (wasActive) {
        this.notifyCallbacks();
      }
    }, this.INACTIVITY_TIMEOUT);

    this.disconnectTimer = setTimeout(() => {
      if (!this.isActive) {
        this.triggerCompleteDisconnect();
      }
    }, this.DISCONNECT_TIMEOUT);
  }

  private triggerCompleteDisconnect() {
    if (this.isCompletelyDisconnected) return;
    
    this.isCompletelyDisconnected = true;
    this.isActive = false;
    
    this.notifyCallbacks();
    
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => {
      try {
        callback(this.isActive, this.lastActivity);
      } catch {
        // Silent fail
      }
    });
  }

  public subscribe(callback: ActivityCallback): () => void {
    this.callbacks.push(callback);
    callback(this.isActive, this.lastActivity);
    
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
      isCompletelyDisconnected: this.isCompletelyDisconnected,
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
    
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    this.eventListeners = [];
    this.callbacks = [];
  }
}

export const userActivityManager = new UserActivityManager();
