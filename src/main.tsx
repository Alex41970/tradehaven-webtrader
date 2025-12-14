import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { tradingWebSocketService } from './services/TradingWebSocketService';
import { PriceProvider } from './contexts/PriceContext';

// Initialize trading WebSocket connection
tradingWebSocketService.connect();

createRoot(document.getElementById("root")!).render(
  <PriceProvider>
    <App />
  </PriceProvider>
);
