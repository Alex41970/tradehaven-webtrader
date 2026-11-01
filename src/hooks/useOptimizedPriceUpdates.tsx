import { useState, useEffect, useRef, useCallback } from 'react';

export type PriceIntensity = 'off' | 'low' | 'medium' | 'high';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  isSimulated?: boolean;
  category?: string;
  /** When the real price last actually changed (ms) */
  changedAt?: number;
}

// Size of one simulated step per asset type (fraction of price)
const BASE_VOLATILITY: Record<string, number> = {
  crypto: 0.0004,
  forex: 0.00004,
  commodities: 0.00012,
  indices: 0.00008,
  stocks: 0.0002,
};

// The simulated price never drifts more than this from the real server price.
// The server accepts client prices only within 0.25% of the market, so stay well inside it.
export const MAX_SIMULATED_DEVIATION = 0.0015;

// A market whose real price hasn't moved for this long is treated as closed: no fake movement.
export const CLOSED_AFTER_MS = 30 * 60_000;
export const isMarketQuiet = (u: { changedAt?: number; category?: string }, now = Date.now()) =>
  u.changedAt != null && u.changedAt > 0 && now - u.changedAt > CLOSED_AFTER_MS;

// Interval fixed at 2s; intensity only changes the SIZE of movements
const INTENSITY_CONFIG: Record<PriceIntensity, { interval: number; multiplier: number }> = {
  off: { interval: 0, multiplier: 0 },
  low: { interval: 2000, multiplier: 0.3 },
  medium: { interval: 2000, multiplier: 1 },
  high: { interval: 2000, multiplier: 2 },
};

function roundPrice(p: number): number {
  if (p < 0.01) return Number(p.toPrecision(4));
  if (p < 1) return Number(p.toPrecision(5));
  if (p < 100) return Number(p.toFixed(5));
  return Number(p.toFixed(2));
}

interface UseOptimizedPriceUpdatesOptions {
  intensity?: PriceIntensity;
  isMarketClosed?: boolean;
}

/**
 * Real prices come from the server (refreshed every minute). Between refreshes a small,
 * mean-reverting movement is simulated around the real price so the screen feels live
 * without ever drifting away from the market.
 */
export const useOptimizedPriceUpdates = (options: UseOptimizedPriceUpdatesOptions = {}) => {
  const { intensity = 'medium', isMarketClosed = false } = options;

  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const realPricesRef = useRef<Map<string, PriceUpdate>>(new Map());
  // Current offset from the real price, as a fraction (e.g. 0.0004 = +0.04%)
  const offsetsRef = useRef<Map<string, number>>(new Map());

  const config = INTENSITY_CONFIG[intensity];

  useEffect(() => {
    if (intensity === 'off' || isMarketClosed || config.interval === 0) {
      // Show the plain real prices
      offsetsRef.current.clear();
      setPrices(new Map(realPricesRef.current));
      return;
    }

    const tick = () => {
      if (realPricesRef.current.size === 0 || document.visibilityState === 'hidden') return;
      const next = new Map<string, PriceUpdate>();
      const now = Date.now();
      realPricesRef.current.forEach((real, symbol) => {
        if (isMarketQuiet(real, now)) {
          offsetsRef.current.delete(symbol);
          next.set(symbol, real);
          return;
        }
        const step = (BASE_VOLATILITY[real.category ?? 'stocks'] ?? BASE_VOLATILITY.stocks) * config.multiplier;
        const prev = offsetsRef.current.get(symbol) ?? 0;
        // Random step plus a pull back towards the real price
        let offset = prev * 0.9 + (Math.random() * 2 - 1) * step;
        offset = Math.max(-MAX_SIMULATED_DEVIATION, Math.min(MAX_SIMULATED_DEVIATION, offset));
        offsetsRef.current.set(symbol, offset);
        next.set(symbol, { ...real, price: roundPrice(real.price * (1 + offset)), timestamp: now, isSimulated: true });
      });
      setPrices(next);
    };

    const id = setInterval(tick, config.interval);
    return () => clearInterval(id);
  }, [intensity, isMarketClosed, config.interval, config.multiplier]);

  // Replace the real prices (offsets are kept so the display moves smoothly to the new level)
  const addPriceUpdates = useCallback((updates: PriceUpdate[]) => {
    updates.forEach((u) => realPricesRef.current.set(u.symbol, u));
    setPrices((prev) => {
      const next = new Map(prev);
      updates.forEach((u) => {
        const offset = offsetsRef.current.get(u.symbol) ?? 0;
        next.set(u.symbol, { ...u, price: roundPrice(u.price * (1 + offset)) });
      });
      return next;
    });
  }, []);

  const addPriceUpdate = useCallback((u: PriceUpdate) => addPriceUpdates([u]), [addPriceUpdates]);

  return { prices, addPriceUpdate, addPriceUpdates };
};
