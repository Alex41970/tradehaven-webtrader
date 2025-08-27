import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 426, headers: corsHeaders });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let isConnected = false;
  let priceInterval: number | null = null;
  let assets: any[] = [];

  socket.onopen = async () => {
    console.log("WebSocket connection opened");
    isConnected = true;
    
    // Fetch initial assets
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      assets = data || [];
      
      // Send initial prices
      const initialPrices: PriceUpdate[] = assets.map(asset => ({
        symbol: asset.symbol,
        price: asset.price,
        change_24h: asset.change_24h,
        timestamp: Date.now()
      }));
      
      socket.send(JSON.stringify({
        type: 'initial_prices',
        data: initialPrices
      }));
      
      // Start real-time price updates (every 1 second)
      priceInterval = setInterval(() => {
        if (isConnected) {
          sendPriceUpdates();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error fetching assets:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial data'
      }));
    }
  };

  const sendPriceUpdates = async () => {
    try {
      const priceUpdates: PriceUpdate[] = assets.map(asset => {
        // Generate realistic price fluctuations
        const volatility = getVolatilityForCategory(asset.category);
        const priceChange = (Math.random() - 0.5) * 2 * volatility;
        const newPrice = Math.max(0.0001, asset.price + priceChange);
        
        // Update the asset price for next iteration
        asset.price = newPrice;
        
        // Calculate 24h change (simulate with smaller random changes)
        const changeVariation = (Math.random() - 0.5) * 0.1;
        asset.change_24h = asset.change_24h + changeVariation;
        
        return {
          symbol: asset.symbol,
          price: newPrice,
          change_24h: asset.change_24h,
          timestamp: Date.now()
        };
      });

      socket.send(JSON.stringify({
        type: 'price_update',
        data: priceUpdates
      }));

      // Update database every 10 seconds to avoid too many writes
      if (Date.now() % 10000 < 1000) {
        updateDatabasePrices(priceUpdates);
      }

    } catch (error) {
      console.error('Error sending price updates:', error);
    }
  };

  const updateDatabasePrices = async (priceUpdates: PriceUpdate[]) => {
    try {
      for (const update of priceUpdates) {
        await supabase
          .from('assets')
          .update({
            price: update.price,
            change_24h: update.change_24h,
            updated_at: new Date().toISOString()
          })
          .eq('symbol', update.symbol);
      }
    } catch (error) {
      console.error('Error updating database:', error);
    }
  };

  const getVolatilityForCategory = (category: string): number => {
    switch (category) {
      case 'crypto':
        return 0.002; // Higher volatility for crypto
      case 'forex':
        return 0.0001; // Lower volatility for forex
      case 'stocks':
        return 0.001;
      case 'commodities':
        return 0.0015;
      case 'indices':
        return 0.0008;
      default:
        return 0.001;
    }
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
    }
  };

  return response;
});