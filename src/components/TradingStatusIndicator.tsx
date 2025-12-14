import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { tradingWebSocket } from '@/services/TradingWebSocketService';

const TradingStatusIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleConnectionSuccess = () => {
      setIsConnected(true);
      setHasError(false);
    };

    const handleConnectionError = () => {
      setIsConnected(false);
      setHasError(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Set up event listeners (event-based, no polling)
    tradingWebSocket.on('auth_success', handleConnectionSuccess);
    tradingWebSocket.on('auth_error', handleConnectionError);
    tradingWebSocket.on('error', handleConnectionError);
    tradingWebSocket.on('disconnect', handleDisconnect);

    // Check connection status once on mount
    setIsConnected(tradingWebSocket.isConnected());

    return () => {
      tradingWebSocket.off('auth_success', handleConnectionSuccess);
      tradingWebSocket.off('auth_error', handleConnectionError);
      tradingWebSocket.off('error', handleConnectionError);
      tradingWebSocket.off('disconnect', handleDisconnect);
    };
  }, []);

  const getStatusInfo = () => {
    if (hasError) {
      return {
        icon: AlertCircle,
        text: 'Error',
        variant: 'destructive' as const,
        color: 'text-red-600'
      };
    }
    
    if (isConnected) {
      return {
        icon: Wifi,
        text: 'Real-time',
        variant: 'default' as const,
        color: 'text-green-600'
      };
    }
    
    return {
      icon: WifiOff,
      text: 'Offline',
      variant: 'secondary' as const,
      color: 'text-gray-600'
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <Badge 
      variant={status.variant}
      className="flex items-center gap-1 text-xs"
    >
      <Icon className={`h-3 w-3 ${status.color}`} />
      {status.text}
    </Badge>
  );
};

export default TradingStatusIndicator;