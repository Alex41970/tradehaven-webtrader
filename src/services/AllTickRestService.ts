import { getSymbolCount } from '@/config/allTickSymbolMapping';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source: string;
}

interface AllTickRestResponse {
  success: boolean;
  prices: PriceUpdate[];
  timestamp: number;
  stats?: {
    requested: number;
    received: number;
    failed: number;
    successRate: string;
  };
}

/**
 * AllTick REST API Service with Circuit Breaker
 * Polls the alltick-relay edge function for price updates every 2 seconds
 * Supports 100 symbols (AllTick API limit)
 * Rate: 30 requests/min (50% of 60/min limit - safe buffer)
 */
export class AllTickRestService {
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private edgeFunctionUrl = 'https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/alltick-relay';
  
  // Circuit breaker state
  private consecutiveFailures = 0;
  private maxFailures = 3;
  private circuitBreakerTimeout: NodeJS.Timeout | null = null;
  private isCircuitOpen = false;
  private retryDelay = 1000; // Start with 1 second

  // Using shared symbol mapping from config (100 symbols total)

  constructor() {
    // Service initialized
  }

  async connect(): Promise<boolean> {
    if (this.isPolling) {
      return true;
    }

    this.isPolling = true;
    this.startPolling();
    return true;
  }

  /**
   * Start polling for price updates every 2 seconds
   * Rate: 30 requests/min (50% of 60/min limit)
   */
  private startPolling(): void {
    // Start immediately, then every 2 seconds
    this.fetchBatch();
    
    this.pollingInterval = setInterval(() => {
      this.fetchBatch();
    }, 2000); // 2 seconds = 30 requests per minute (50% of limit)
    
    console.log('🔄 AllTick REST polling started (2s intervals, 30 req/min)');
  }

  private async fetchBatch(): Promise<void> {
    // Circuit breaker: skip if open
    if (this.isCircuitOpen) {
      console.log('⚠️ Circuit breaker open, skipping fetch');
      return;
    }

    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: AllTickRestResponse = await response.json();
      
      if (!result.success || !result.prices || !Array.isArray(result.prices)) {
        console.error('Invalid response from AllTick relay:', result);
        this.handleFailure();
        return;
      }
      
      // Success: reset circuit breaker
      this.consecutiveFailures = 0;
      this.retryDelay = 1000;
      this.isCircuitOpen = false;
      
      // Process each price update
      result.prices.forEach((priceData: any) => {
        if (priceData && priceData.symbol) {
          const update: PriceUpdate = {
            symbol: priceData.symbol,
            price: priceData.price,
            change_24h: priceData.change_24h || 0,
            timestamp: priceData.timestamp || Date.now(),
            source: 'AllTick'
          };
          
          this.subscribers.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('Error in price update callback:', error);
            }
          });
        }
      });

      // Log stats if available
      if (result.stats) {
        console.log(`✅ AllTick REST: ${result.stats.received}/${result.stats.requested} symbols (${result.stats.successRate})`);
        if (result.stats.failed > 0) {
          console.warn(`⚠️ ${result.stats.failed} symbols failed to update`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching prices from AllTick relay:', error);
      this.handleFailure();
    }
  }

  private handleFailure(): void {
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= this.maxFailures) {
      console.warn(`🚨 Circuit breaker OPEN after ${this.consecutiveFailures} failures. Pausing for 60s...`);
      this.isCircuitOpen = true;
      
      // Close circuit breaker after 60 seconds
      if (this.circuitBreakerTimeout) {
        clearTimeout(this.circuitBreakerTimeout);
      }
      
      this.circuitBreakerTimeout = setTimeout(() => {
        console.log('🔄 Circuit breaker CLOSED, resuming requests...');
        this.isCircuitOpen = false;
        this.consecutiveFailures = 0;
        this.retryDelay = 1000;
      }, 60000);
    } else {
      // Exponential backoff: 1s, 2s, 5s
      const delays = [1000, 2000, 5000];
      this.retryDelay = delays[Math.min(this.consecutiveFailures - 1, delays.length - 1)];
      console.log(`⏳ Retry ${this.consecutiveFailures}/${this.maxFailures} with ${this.retryDelay}ms delay`);
    }
  }

  subscribeToPrices(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  isConnected(): boolean {
    return this.isPolling;
  }

  /**
   * Get the number of symbols being monitored (100 total)
   */
  public getSymbolCount(): number {
    return getSymbolCount(); // Returns 100 from shared config
  }

  disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
      this.circuitBreakerTimeout = null;
    }
    
    this.isPolling = false;
    this.subscribers.clear();
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
  }
}
