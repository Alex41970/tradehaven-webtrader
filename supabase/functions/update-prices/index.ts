import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PriceData {
  symbol: string;
  price: number;
  change_24h: number;
}

// AllTick symbol mapping (copied from shared config)
const ALLTICK_SYMBOL_MAP: Record<string, string> = {
  // Forex
  'EURUSD': 'EURUSD', 'GBPUSD': 'GBPUSD', 'USDJPY': 'USDJPY', 'AUDUSD': 'AUDUSD',
  'USDCAD': 'USDCAD', 'USDCHF': 'USDCHF', 'NZDUSD': 'NZDUSD', 'EURGBP': 'EURGBP',
  'EURJPY': 'EURJPY', 'GBPJPY': 'GBPJPY', 'EURCHF': 'EURCHF', 'AUDJPY': 'AUDJPY',
  // Crypto
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'BNBUSD': 'BNBUSDT', 'ADAUSD': 'ADAUSDT',
  'SOLUSD': 'SOLUSDT', 'XRPUSD': 'XRPUSDT', 'DOTUSD': 'DOTUSDT', 'LINKUSD': 'LINKUSDT',
  'LTCUSD': 'LTCUSDT', 'MATICUSD': 'MATICUSDT', 'DOGEUSD': 'DOGEUSDT',
  // Commodities
  'XAUUSD': 'XAUUSD', 'XAGUSD': 'Silver', 'WTIUSD': 'USOIL', 'BCOUSD': 'UKOIL',
  // Stocks
  'AAPL': 'AAPL.US', 'MSFT': 'MSFT.US', 'GOOGL': 'GOOGL.US', 'AMZN': 'AMZN.US',
  'NVDA': 'NVDA.US', 'TSLA': 'TSLA.US', 'META': 'META.US',
  // Indices
  'SPX500': 'US500', 'NAS100': 'NAS100', 'US30': 'US30'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting price update process...');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      throw assetsError;
    }

    console.log(`Found ${assets?.length || 0} assets to update`);

    const priceUpdates: PriceData[] = [];
    const apiKey = Deno.env.get('ALLTICK_API_KEY');

    if (!apiKey) {
      throw new Error('ALLTICK_API_KEY not configured');
    }

    // Helper function to fetch price from AllTick REST API
    const getAllTickPrice = async (symbol: string, allTickCode: string, isStock: boolean): Promise<{ price: number; change: number } | null> => {
      try {
        const baseUrl = isStock 
          ? 'https://quote.alltick.io/quote-stock-b-api/trade-tick'
          : 'https://quote.alltick.io/quote-b-api/trade-tick';
        
        const url = `${baseUrl}?token=${apiKey}&query=${allTickCode}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          console.error(`AllTick API error for ${symbol}: ${response.status}`);
          return null;
        }

        const data = await response.json();
        
        if (data.data?.trade_tick?.length > 0) {
          const tick = data.data.trade_tick[0];
          const price = parseFloat(tick.price || tick.close || 0);
          const change = parseFloat(tick.change || 0);
          
          console.log(`✅ ${symbol}: $${price} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
          return { price, change };
        }
        
        return null;
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        return null;
      }
    };

    // Process all assets with 1.5s spacing to respect rate limits
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      try {
        let newPrice = asset.price;
        let change24h = asset.change_24h || 0;
        let priceFound = false;

        // Check if symbol is supported by AllTick
        const allTickCode = ALLTICK_SYMBOL_MAP[asset.symbol];
        
        if (allTickCode) {
          // Space requests 1.5 seconds apart (except first request)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          const isStock = asset.category === 'stocks';
          const priceData = await getAllTickPrice(asset.symbol, allTickCode, isStock);
          
          if (priceData && priceData.price > 0) {
            newPrice = priceData.price;
            change24h = priceData.change;
            priceFound = true;
          }
        }

        // Fallback to small variation if no price found
        if (!priceFound) {
          const changePercent = (Math.random() - 0.5) * 0.02;
          newPrice = asset.price * (1 + changePercent);
          change24h = ((newPrice - asset.price) / asset.price) * 100;
          console.log(`⚠️ ${asset.symbol}: Using fallback variation`);
        }

        const decimals = (asset.category === 'forex' || asset.category === 'crypto') ? 4 : 2;
        priceUpdates.push({
          symbol: asset.symbol,
          price: parseFloat(newPrice.toFixed(decimals)),
          change_24h: parseFloat(change24h.toFixed(decimals))
        });

      } catch (error) {
        console.error(`Error updating ${asset.symbol}:`, error);
        priceUpdates.push({
          symbol: asset.symbol,
          price: asset.price,
          change_24h: asset.change_24h || 0
        });
      }
    }

    // Process all assets with fallback logic
    for (const asset of assets) {
      try {
        let newPrice = asset.price;
        let change24h = 0;
        let priceFound = false;

        if (asset.category === 'crypto' && cryptoPrices.has(asset.symbol)) {
          const cryptoData = cryptoPrices.get(asset.symbol)!;
          if (cryptoData.price > 0) {
            // Use real API price
            newPrice = cryptoData.price;
            change24h = cryptoData.change;
            priceFound = true;
            console.log(`${asset.symbol}: Real price $${newPrice} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`);
          } else {
            // Use existing price with API change percentage
            newPrice = asset.price * (1 + cryptoData.change / 100);
            change24h = cryptoData.change;
            priceFound = true;
            console.log(`${asset.symbol}: Adjusted price $${newPrice} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`);
          }
        } else if (asset.category === 'forex' && forexRates.has(asset.symbol)) {
          const oldPrice = asset.price;
          newPrice = forexRates.get(asset.symbol)!;
          change24h = ((newPrice - oldPrice) / oldPrice) * 100;
          priceFound = true;
          console.log(`${asset.symbol}: Real rate ${newPrice} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`);
        } else if (asset.category === 'commodities') {
          // Use current realistic commodity prices with small variations
          const basePrice = asset.price;
          const changePercent = (Math.random() - 0.5) * 0.03; // -1.5% to +1.5% change
          newPrice = basePrice * (1 + changePercent);
          change24h = (newPrice - basePrice);
          priceFound = true;
          console.log(`${asset.symbol}: Simulated price $${newPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${(changePercent * 100).toFixed(2)}%)`);
        } else if (asset.category === 'indices') {
          // Use current realistic index prices with small variations
          const basePrice = asset.price;
          const changePercent = (Math.random() - 0.5) * 0.025; // -1.25% to +1.25% change
          newPrice = basePrice * (1 + changePercent);
          change24h = (newPrice - basePrice);
          priceFound = true;
          console.log(`${asset.symbol}: Simulated price $${newPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${(changePercent * 100).toFixed(2)}%)`);
        }

        // If no price found, use small realistic variation
        if (!priceFound) {
          const changePercent = (Math.random() - 0.5) * 0.02; // -1% to +1% change
          newPrice = asset.price * (1 + changePercent);
          change24h = (newPrice - asset.price);
          console.log(`${asset.symbol}: Default variation $${newPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${(changePercent * 100).toFixed(2)}%)`);
        }

        const decimals = (asset.category === 'forex' || asset.category === 'crypto') ? 4 : 2;
        priceUpdates.push({
          symbol: asset.symbol,
          price: parseFloat(newPrice.toFixed(decimals)),
          change_24h: parseFloat(change24h.toFixed(decimals))
        });

      } catch (error) {
        console.error(`Error updating ${asset.symbol}:`, error);
        // Fallback to small variation
        const changePercent = (Math.random() - 0.5) * 0.02;
        const newPrice = asset.price * (1 + changePercent);
        const change24h = newPrice - asset.price;
        
        const decimals = (asset.category === 'forex' || asset.category === 'crypto') ? 4 : 2;
        priceUpdates.push({
          symbol: asset.symbol,
          price: parseFloat(newPrice.toFixed(decimals)),
          change_24h: parseFloat(change24h.toFixed(decimals))
        });
      }
    }

    console.log('Generated price updates:', priceUpdates.length);

    // Update prices in database
    for (const update of priceUpdates) {
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          price: update.price,
          change_24h: update.change_24h,
          updated_at: new Date().toISOString()
        })
        .eq('symbol', update.symbol);

      if (updateError) {
        console.error(`Error updating ${update.symbol}:`, updateError);
      }
    }

    // Update P&L for all open trades
    const { data: openTrades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'open');

    if (tradesError) {
      console.error('Error fetching open trades:', tradesError);
    } else {
      console.log(`Updating P&L for ${openTrades?.length || 0} open trades`);
      
      for (const trade of openTrades || []) {
        const asset = assets?.find(a => a.id === trade.asset_id);
        if (asset) {
          const updatedPrice = priceUpdates.find(p => p.symbol === asset.symbol);
          if (updatedPrice) {
            let pnl: number;
            if (asset.category === 'forex') {
              // For forex: P&L = lot_size * contract_size * price_difference
              const priceDifference = trade.trade_type === 'BUY' 
                ? (updatedPrice.price - trade.open_price)
                : (trade.open_price - updatedPrice.price);
              pnl = trade.amount * (asset.contract_size || 100000) * priceDifference;
            } else {
              // For other instruments: P&L = amount * price_difference
              pnl = trade.trade_type === 'BUY' 
                ? trade.amount * (updatedPrice.price - trade.open_price)
                : trade.amount * (trade.open_price - updatedPrice.price);
            }

            await supabase
              .from('trades')
              .update({
                current_price: updatedPrice.price,
                pnl: parseFloat(pnl.toFixed(2)),
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);
          }
        }
      }
    }

    console.log('Price update completed successfully');

    // After price updates, recalculate equity for all users with open trades
    const { data: usersWithOpenTrades, error: usersError } = await supabase
      .from('trades')
      .select('user_id')
      .eq('status', 'open');

    if (!usersError && usersWithOpenTrades) {
      const uniqueUserIds = [...new Set(usersWithOpenTrades.map(trade => trade.user_id))];
      console.log(`Updating equity for ${uniqueUserIds.length} users with open trades`);
      
      for (const userId of uniqueUserIds) {
        // Use the existing RPC function to recalculate margins/equity
        const { error: recalcError } = await supabase
          .rpc('auto_recalculate_user_margins', { _user_id: userId });
        
        if (recalcError) {
          console.error(`Error recalculating equity for user ${userId}:`, recalcError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: priceUpdates.length,
        message: 'Prices updated successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Price update failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})