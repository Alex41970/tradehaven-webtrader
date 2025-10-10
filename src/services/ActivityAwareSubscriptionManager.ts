import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { userActivityManager } from './UserActivityManager';

interface SubscriptionConfig {
  channel: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

interface ActiveSubscription {
  id: string;
  config: SubscriptionConfig;
  channel: RealtimeChannel;
  isPaused: boolean;
}

export class ActivityAwareSubscriptionManager {
  private subscriptions = new Map<string, ActiveSubscription>();
  private supabase: SupabaseClient;
  private isUserActive = true;
  private isCompletelyDisconnected = false;
  private activityUnsubscribe: (() => void) | null = null;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    this.activityUnsubscribe = userActivityManager.subscribe((isActive, lastActivity) => {
      const state = userActivityManager.getState();
      const wasActive = this.isUserActive;
      const wasDisconnected = this.isCompletelyDisconnected;

      this.isUserActive = isActive;
      this.isCompletelyDisconnected = state.isCompletelyDisconnected;

      // Handle transitions
      if (wasDisconnected && !state.isCompletelyDisconnected) {
        this.reactivateAllSubscriptions();
      } else if (!wasDisconnected && state.isCompletelyDisconnected) {
        this.pauseAllSubscriptions();
      } else if (wasActive && !isActive && !state.isCompletelyDisconnected) {
        this.pauseAllSubscriptions();
      } else if (!wasActive && isActive && !state.isCompletelyDisconnected) {
        this.resumeAllSubscriptions();
      }
    });
  }

  subscribe(config: SubscriptionConfig): string {
    const subscriptionId = `${config.table}_${config.channel}_${Date.now()}_${Math.random()}`;

    // Only create active subscription if user is active
    if (this.isUserActive && !this.isCompletelyDisconnected) {
      const channel = this.createRealtimeChannel(config);
      
      const subscription: ActiveSubscription = {
        id: subscriptionId,
        config,
        channel,
        isPaused: false,
      };

      this.subscriptions.set(subscriptionId, subscription);
    } else {
      // Create paused subscription
      const subscription: ActiveSubscription = {
        id: subscriptionId,
        config,
        channel: null as any, // Will be created when resumed
        isPaused: true,
      };

      this.subscriptions.set(subscriptionId, subscription);
    }

    return subscriptionId;
  }

  private createRealtimeChannel(config: SubscriptionConfig): RealtimeChannel {
    const channel = this.supabase.channel(config.channel);
    
    const subscriptionConfig: any = {
      event: config.event,
      schema: config.schema,
      table: config.table,
    };

    if (config.filter) {
      subscriptionConfig.filter = config.filter;
    }

    channel.on('postgres_changes', subscriptionConfig, (payload) => {
      // Only process if user is active
      if (this.isUserActive && !this.isCompletelyDisconnected) {
        config.callback(payload);
      }
    });

    channel.subscribe();

    return channel;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      if (subscription.channel && !subscription.isPaused) {
        this.supabase.removeChannel(subscription.channel);
      }
      this.subscriptions.delete(subscriptionId);
    }
  }

  private pauseAllSubscriptions(): void {
    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.isPaused && subscription.channel) {
        this.supabase.removeChannel(subscription.channel);
        subscription.isPaused = true;
        subscription.channel = null as any;
      }
    }
  }

  private resumeAllSubscriptions(): void {
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.isPaused) {
        subscription.channel = this.createRealtimeChannel(subscription.config);
        subscription.isPaused = false;
      }
    }
  }

  private reactivateAllSubscriptions(): void {
    // Remove any existing channels first
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.channel && !subscription.isPaused) {
        this.supabase.removeChannel(subscription.channel);
      }
    }

    // Create fresh channels for all subscriptions
    for (const [id, subscription] of this.subscriptions) {
      subscription.channel = this.createRealtimeChannel(subscription.config);
      subscription.isPaused = false;
    }
  }

  cleanup(): void {
    
    // Remove all channels
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.channel && !subscription.isPaused) {
        this.supabase.removeChannel(subscription.channel);
      }
    }
    
    this.subscriptions.clear();
    
    if (this.activityUnsubscribe) {
      this.activityUnsubscribe();
      this.activityUnsubscribe = null;
    }
  }

  // Debug method to see subscription status
  getSubscriptionStatus() {
    const status = {
      total: this.subscriptions.size,
      active: 0,
      paused: 0,
      userActive: this.isUserActive,
      userDisconnected: this.isCompletelyDisconnected,
    };

    for (const subscription of this.subscriptions.values()) {
      if (subscription.isPaused) {
        status.paused++;
      } else {
        status.active++;
      }
    }

    return status;
  }
}

// Singleton instance - will be created when first imported
let subscriptionManagerInstance: ActivityAwareSubscriptionManager | null = null;

export const getActivityAwareSubscriptionManager = (supabaseClient: SupabaseClient): ActivityAwareSubscriptionManager => {
  if (!subscriptionManagerInstance) {
    subscriptionManagerInstance = new ActivityAwareSubscriptionManager(supabaseClient);
  }
  return subscriptionManagerInstance;
};