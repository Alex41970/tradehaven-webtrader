import { useAccount } from './useAccount';

/**
 * State of the live trading link. Trading works without it (orders then go straight
 * to the database), so this is only for the connection badge.
 */
export const useRealTimeTrading = () => {
  const link = useAccount((s) => s.link);
  return { isConnected: link === 'live', loading: link === 'connecting' };
};
