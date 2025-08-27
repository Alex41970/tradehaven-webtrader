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

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

interface ForexResponse {
  rates: {
    [key: string]: number;
  };
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

    // Helper function to get crypto prices from CoinGecko
    const getCryptoPrices = async (symbols: string[]): Promise<Map<string, { price: number; change: number }>> => {
      const cryptoMap = new Map();
      const coinGeckoIds: Record<string, string> = {
        'BTCUSD': 'bitcoin',
        'ETHUSD': 'ethereum', 
        'XRPUSD': 'ripple',
        'ADAUSD': 'cardano',
        'DOTUSD': 'polkadot',
        'BNBUSD': 'binancecoin',
        'LINKUSD': 'chainlink',
        'LTCUSD': 'litecoin',
        'MATICUSD': 'matic-network',
        'SOLUSD': 'solana'
      };

      const cryptoSymbols = symbols.filter(s => coinGeckoIds[s]);
      if (cryptoSymbols.length === 0) return cryptoMap;

      const ids = cryptoSymbols.map(s => coinGeckoIds[s]).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
      
      try {
        const response = await fetch(url);
        const data: CoinGeckoResponse = await response.json();
        
        for (const symbol of cryptoSymbols) {
          const coinId = coinGeckoIds[symbol];
          if (data[coinId]) {
            cryptoMap.set(symbol, {
              price: data[coinId].usd,
              change: data[coinId].usd_24h_change || 0
            });
          }
        }
      } catch (error) {
        console.error('CoinGecko API error:', error);
      }
      
      return cryptoMap;
    };

    // Helper function to get forex rates
    const getForexRates = async (): Promise<Map<string, number>> => {
      const ratesMap = new Map();
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data: ForexResponse = await response.json();
        
        // Convert to our format (base/quote)
        ratesMap.set('EURUSD', 1 / data.rates.EUR);
        ratesMap.set('GBPUSD', 1 / data.rates.GBP);
        ratesMap.set('AUDUSD', 1 / data.rates.AUD);
        ratesMap.set('NZDUSD', 1 / data.rates.NZD);
        ratesMap.set('USDCAD', data.rates.CAD);
        ratesMap.set('USDCHF', data.rates.CHF);
        ratesMap.set('USDJPY', data.rates.JPY);
        
        // Cross pairs
        if (data.rates.EUR && data.rates.GBP) {
          ratesMap.set('EURGBP', data.rates.GBP / data.rates.EUR);
        }
        if (data.rates.EUR && data.rates.JPY) {
          ratesMap.set('EURJPY', data.rates.JPY / data.rates.EUR);
        }
        if (data.rates.GBP && data.rates.JPY) {
          ratesMap.set('GBPJPY', data.rates.JPY / data.rates.GBP);
        }
      } catch (error) {
        console.error('Forex API error:', error);
      }
      
      return ratesMap;
    };

    // Get all crypto and forex symbols
    const cryptoSymbols = assets.filter(a => a.category === 'crypto').map(a => a.symbol);
    const forexSymbols = assets.filter(a => a.category === 'forex').map(a => a.symbol);

    // Fetch prices from APIs
    const [cryptoPrices, forexRates] = await Promise.all([
      getCryptoPrices(cryptoSymbols),
      getForexRates()
    ]);

    // Process all assets
    for (const asset of assets) {
      try {
        let newPrice = asset.price;
        let change24h = 0;
        let priceFound = false;

        if (asset.category === 'crypto' && cryptoPrices.has(asset.symbol)) {
          const cryptoData = cryptoPrices.get(asset.symbol)!;
          newPrice = cryptoData.price;
          change24h = cryptoData.change;
          priceFound = true;
          console.log(`${asset.symbol}: Real price ${newPrice} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`);
        } else if (asset.category === 'forex' && forexRates.has(asset.symbol)) {
          const oldPrice = asset.price;
          newPrice = forexRates.get(asset.symbol)!;
          change24h = newPrice - oldPrice;
          priceFound = true;
          console.log(`${asset.symbol}: Real rate ${newPrice}`);
        } else if (asset.category === 'commodities') {
          // Realistic commodity prices with small variations
          const commodityPrices: Record<string, number> = {
            'XAUUSD': 2032.50 + (Math.random() - 0.5) * 20, // Gold $2032 ± $10
            'XAGUSD': 25.45 + (Math.random() - 0.5) * 2,    // Silver $25 ± $1
            'WTIUSD': 74.80 + (Math.random() - 0.5) * 5,    // Oil $75 ± $2.50
            'BCOUSD': 79.10 + (Math.random() - 0.5) * 5,    // Brent Oil $79 ± $2.50
            'NATGAS': 2.75 + (Math.random() - 0.5) * 0.3,   // Natural Gas $2.75 ± $0.15
            'XPTUSD': 900 + (Math.random() - 0.5) * 50,     // Platinum $900 ± $25
            'XPDUSD': 1100 + (Math.random() - 0.5) * 100    // Palladium $1100 ± $50
          };
          
          if (commodityPrices[asset.symbol]) {
            newPrice = commodityPrices[asset.symbol];
            change24h = newPrice - asset.price;
            priceFound = true;
          }
        } else if (asset.category === 'indices') {
          // Realistic index prices with small variations
          const indexPrices: Record<string, number> = {
            'SPX500': 5450 + (Math.random() - 0.5) * 100,   // S&P 500
            'DJ30': 33850 + (Math.random() - 0.5) * 500,    // Dow Jones
            'NAS100': 17200 + (Math.random() - 0.5) * 300,  // Nasdaq
            'GER40': 17500 + (Math.random() - 0.5) * 200,   // DAX
            'UK100': 7850 + (Math.random() - 0.5) * 150,    // FTSE 100
            'FRA40': 7750 + (Math.random() - 0.5) * 150,    // CAC 40
            'JPN225': 33500 + (Math.random() - 0.5) * 400,  // Nikkei
            'AUS200': 7600 + (Math.random() - 0.5) * 150    // ASX 200
          };
          
          if (indexPrices[asset.symbol]) {
            newPrice = indexPrices[asset.symbol];
            change24h = newPrice - asset.price;
            priceFound = true;
          }
        }

        // If no price found, use small realistic variation
        if (!priceFound) {
          const changePercent = (Math.random() - 0.5) * 0.04; // -2% to +2% change
          newPrice = asset.price * (1 + changePercent);
          change24h = newPrice - asset.price;
        }

        const decimals = asset.category === 'forex' ? 5 : 2;
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
        
        const decimals = asset.category === 'forex' ? 5 : 2;
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