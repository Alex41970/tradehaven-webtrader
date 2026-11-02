import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Importing the service registers its auth listener; it connects once a user session exists.
import './services/TradingWebSocketService';

createRoot(document.getElementById("root")!).render(<App />);
