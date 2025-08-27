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

interface AlphaVantageQuote {
  "01. symbol": string;
  "05. price": string;
  "09. change": string;
  "10. change percent": string;
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

    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY') ?? '';

    console.log(`Found ${assets?.length || 0} assets to update`);

    // Map asset symbols to Alpha Vantage symbols
    const getAlphaVantageSymbol = (symbol: string): string => {
      const symbolMappings: Record<string, string> = {
        // Crypto
        'BTCUSD': 'BTC',
        'ETHUSD': 'ETH',
        'XRPUSD': 'XRP',
        'ADAUSD': 'ADA',
        'DOTUSD': 'DOT',
        
        // Stocks (already correct)
        'AAPL': 'AAPL',
        'GOOGL': 'GOOGL',
        'TSLA': 'TSLA',
        'MSFT': 'MSFT',
        'AMZN': 'AMZN',
        
        // For forex and others, use original symbol
        'EURUSD': 'EURUSD',
        'GBPUSD': 'GBPUSD',
        'USDJPY': 'USDJPY',
        'USDCHF': 'USDCHF',
        'AUDUSD': 'AUDUSD',
        'USDCAD': 'USDCAD',
        'NZDUSD': 'NZDUSD',
        'XAUUSD': 'XAUUSD',
        'XAGUSD': 'XAGUSD',
      };
      
      return symbolMappings[symbol] || symbol;
    };

    const priceUpdates: PriceData[] = [];

    // Process assets in smaller batches to avoid rate limits
    for (let i = 0; i < assets.length; i += 3) {
      const batch = assets.slice(i, i + 3);
      
      await Promise.all(batch.map(async (asset) => {
        try {
          let newPrice = asset.price;
          let change24h = 0;
          
          if (alphaVantageKey) {
            const alphaSymbol = getAlphaVantageSymbol(asset.symbol);
            let url: string;
            
            // Different endpoints for different asset types
            if (asset.category === 'crypto') {
              url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${alphaSymbol}&to_currency=USD&apikey=${alphaVantageKey}`;
            } else if (asset.category === 'forex') {
              const fromCurrency = asset.symbol.substring(0, 3);
              const toCurrency = asset.symbol.substring(3, 6);
              url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${alphaVantageKey}`;
            } else {
              // Stocks, commodities, indices - use global quote
              url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${alphaSymbol}&apikey=${alphaVantageKey}`;
            }

            try {
              const response = await fetch(url);
              const data = await response.json();
              
              if (asset.category === 'crypto' || asset.category === 'forex') {
                const exchangeRate = data['Realtime Currency Exchange Rate'];
                if (exchangeRate && exchangeRate['5. Exchange Rate']) {
                  newPrice = parseFloat(exchangeRate['5. Exchange Rate']);
                  // Calculate realistic change
                  change24h = newPrice - asset.price;
                }
              } else {
                // Stocks and other assets
                const quote = data['Global Quote'] as AlphaVantageQuote;
                if (quote && quote['05. price']) {
                  newPrice = parseFloat(quote['05. price']);
                  change24h = parseFloat(quote['09. change']) || (newPrice - asset.price);
                }
              }
            } catch (apiError) {
              console.log(`API failed for ${asset.symbol}, using simulation`);
            }
          }
          
          // Fallback to simulation if API fails or no key
          if (newPrice === asset.price) {
            const changePercent = (Math.random() - 0.5) * 0.1; // -5% to +5% change
            newPrice = asset.price * (1 + changePercent);
            change24h = newPrice - asset.price;
          }

          priceUpdates.push({
            symbol: asset.symbol,
            price: parseFloat(newPrice.toFixed(asset.category === 'forex' ? 5 : 2)),
            change_24h: parseFloat(change24h.toFixed(asset.category === 'forex' ? 5 : 2))
          });

          console.log(`Updated ${asset.symbol}: ${newPrice} (${change24h >= 0 ? '+' : ''}${change24h})`);
          
        } catch (error) {
          console.error(`Error updating ${asset.symbol}:`, error);
          // Fallback to simulation
          const changePercent = (Math.random() - 0.5) * 0.1;
          const newPrice = asset.price * (1 + changePercent);
          const change24h = newPrice - asset.price;
          
          priceUpdates.push({
            symbol: asset.symbol,
            price: parseFloat(newPrice.toFixed(asset.category === 'forex' ? 5 : 2)),
            change_24h: parseFloat(change24h.toFixed(asset.category === 'forex' ? 5 : 2))
          });
        }
      }));

      // Add delay between batches to respect rate limits
      if (i + 3 < assets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
            const pnl = trade.trade_type === 'BUY' 
              ? trade.amount * (updatedPrice.price - trade.open_price)
              : trade.amount * (trade.open_price - updatedPrice.price);

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
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})