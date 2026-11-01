import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';
import { useTradingSettings, PriceIntensity } from '@/hooks/useTradingSettings';
import { supabase } from '@/integrations/supabase/client';
import { setContractSizes } from '@/utils/pnlCalculator';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
  category?: string;
}

interface PriceContextType {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  /** Time of the newest real price from the market (not the simulated movement) */
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'paused';
  isUserActive: boolean;
  connectionMode: 'websocket' | 'polling' | 'offline';
  isMarketClosed: boolean;
  canTrade: boolean;
  priceIntensity: PriceIntensity;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};

// Server refreshes prices every minute; reading them is a cheap database read (no realtime channel)
const POLL_MS = 15_000;
const STALE_MS = 5 * 60_000;

export const PriceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { priceIntensity, isMarketClosed, canTrade } = useTradingSettings();
  const { prices, addPriceUpdates } = useOptimizedPriceUpdates({ intensity: priceIntensity, isMarketClosed });

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [status, setStatus] = useState<PriceContextType['connectionStatus']>('connecting');
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!visible) {
      setStatus('paused');
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('symbol, price, change_24h, category, price_updated_at, price_source, contract_size')
        .eq('is_active', true);
      if (cancelled) return;
      if (error || !data) {
        setStatus('disconnected');
        return;
      }
      setContractSizes(data);
      let newest = 0;
      addPriceUpdates(
        data.map((a) => {
          const t = a.price_updated_at ? new Date(a.price_updated_at).getTime() : 0;
          newest = Math.max(newest, t);
          return {
            symbol: a.symbol,
            price: Number(a.price) || 0,
            change_24h: Number(a.change_24h) || 0,
            timestamp: t || Date.now(),
            source: a.price_source ?? undefined,
            category: a.category,
          };
        }),
      );
      setLastUpdate(newest ? new Date(newest) : null);
      setStatus(newest && Date.now() - newest < STALE_MS ? 'connected' : 'disconnected');
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [visible, addPriceUpdates]);

  const value = useMemo<PriceContextType>(
    () => ({
      prices,
      isConnected: status === 'connected',
      lastUpdate,
      connectionStatus: status,
      isUserActive: visible,
      connectionMode: status === 'connected' ? 'polling' : 'offline',
      isMarketClosed,
      canTrade,
      priceIntensity,
    }),
    [prices, status, lastUpdate, visible, isMarketClosed, canTrade, priceIntensity],
  );

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};
