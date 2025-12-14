import { useState, useEffect, useRef, useCallback } from 'react';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  isSimulated?: boolean;
}

// Volatility levels per asset type (percentage per tick)
const VOLATILITY: Record<string, number> = {
  crypto: 0.001,    // 0.1%
  forex: 0.0001,    // 0.01%
  commodity: 0.0003, // 0.03%
  index: 0.0002,    // 0.02%
  stock: 0.0005,    // 0.05%
};

const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'DOT', 'MATIC', 'LTC', 'LINK', 'UNI', 'AAVE', 'ALGO', 'APT', 'ARB', 'AR', 'ATOM', 'AVAX', 'AXS', 'COMP', 'CRO', 'CRV', 'ENJ', 'FTM', 'GALA', 'GRT', 'ICP', 'IMX', 'INJ', 'LDO', 'MANA', 'NEAR', 'OP', 'PEPE', 'RNDR', 'SAND', 'SHIB', 'STX', 'SUI', 'TIA', 'TON', 'TRX', 'UMA', 'VET', 'WLD', 'XLM', 'XTZ', 'FIL'];
const FOREX_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'EURAUD', 'USDMXN', 'USDZAR', 'USDHKD', 'USDSGD', 'USDNOK', 'USDSEK', 'USDDKK'];
const COMMODITY_SYMBOLS = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS', 'XPTUSD', 'COPPER'];
const INDEX_SYMBOLS = ['US30', 'US100', 'US500', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200'];

function getVolatility(symbol: string): number {
  if (CRYPTO_SYMBOLS.some(s => symbol.includes(s))) return VOLATILITY.crypto;
  if (FOREX_SYMBOLS.includes(symbol)) return VOLATILITY.forex;
  if (COMMODITY_SYMBOLS.includes(symbol)) return VOLATILITY.commodity;
  if (INDEX_SYMBOLS.includes(symbol)) return VOLATILITY.index;
  return VOLATILITY.stock;
}

function generateHeartbeatPrice(basePrice: number, volatility: number): number {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const magnitude = Math.random() * volatility;
  const newPrice = basePrice * (1 + direction * magnitude);
  
  if (newPrice < 0.01) return Number(newPrice.toPrecision(4));
  if (newPrice < 1) return Number(newPrice.toPrecision(5));
  if (newPrice < 100) return Number(newPrice.toFixed(4));
  if (newPrice < 10000) return Number(newPrice.toFixed(2));
  return Number(newPrice.toFixed(2));
}

/**
 * Hook for price updates with client-side heartbeat simulation
 * Real prices come from server, heartbeat movements are simulated locally
 */
export const useOptimizedPriceUpdates = () => {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Store real prices separately for heartbeat base
  const realPricesRef = useRef<Map<string, PriceUpdate>>(new Map());
  const simulatedPricesRef = useRef<Map<string, number>>(new Map());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate heartbeat price movements every 2 seconds
  useEffect(() => {
    const runHeartbeat = () => {
      if (realPricesRef.current.size === 0) return;

      setPrices(prev => {
        const newPrices = new Map(prev);
        
        realPricesRef.current.forEach((realData, symbol) => {
          const currentSimulated = simulatedPricesRef.current.get(symbol) || realData.price;
          const volatility = getVolatility(symbol);
          const newPrice = generateHeartbeatPrice(currentSimulated, volatility);
          
          simulatedPricesRef.current.set(symbol, newPrice);
          newPrices.set(symbol, {
            ...realData,
            price: newPrice,
            timestamp: Date.now(),
            isSimulated: true,
          });
        });
        
        return newPrices;
      });
      
      setLastUpdate(new Date());
    };

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(runHeartbeat, 2000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Add real price update from server
  const addPriceUpdate = useCallback((update: PriceUpdate) => {
    // Store as real price (base for simulation)
    realPricesRef.current.set(update.symbol, update);
    // Reset simulated price to real price
    simulatedPricesRef.current.set(update.symbol, update.price);
    
    // Update display immediately
    setPrices(prev => {
      const newPrices = new Map(prev);
      newPrices.set(update.symbol, update);
      return newPrices;
    });
    
    setLastUpdate(new Date());
  }, []);

  // Add multiple real price updates from server
  const addPriceUpdates = useCallback((updates: PriceUpdate[]) => {
    updates.forEach(update => {
      realPricesRef.current.set(update.symbol, update);
      simulatedPricesRef.current.set(update.symbol, update.price);
    });
    
    setPrices(prev => {
      const newPrices = new Map(prev);
      updates.forEach(update => {
        newPrices.set(update.symbol, update);
      });
      return newPrices;
    });
    
    setLastUpdate(new Date());
  }, []);

  return {
    prices,
    lastUpdate,
    addPriceUpdate,
    addPriceUpdates,
  };
};