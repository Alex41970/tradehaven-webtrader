import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { tradingWebSocket } from './services/TradingWebSocketService';
import { PriceProvider } from '@/contexts/PriceContext';

// Initialize trading WebSocket connection
tradingWebSocket.connect();

createRoot(document.getElementById("root")!).render(
  <PriceProvider>
    <App />
  </PriceProvider>
);
