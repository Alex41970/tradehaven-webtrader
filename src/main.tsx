import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PriceProvider } from './contexts/PriceContext';
import { tradingWebSocket } from './services/TradingWebSocketService';

// Initialize trading WebSocket connection
tradingWebSocket.connect();

createRoot(document.getElementById("root")!).render(
  <PriceProvider>
    <App />
  </PriceProvider>
);
