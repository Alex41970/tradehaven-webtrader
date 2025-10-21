/**
 * TradingView Symbol Resolver - All Asset Categories
 * Maps symbols to correct TradingView exchange formats
 */

interface Asset {
  symbol: string;
  category?: string;
  name?: string;
}

// Normalize crypto token tickers that differ from display names
const CRYPTO_TICKER_NORMALIZATIONS: Record<string, string> = {
  'RENDER': 'RNDR',
  'RENDERUSD': 'RNDR',
  'CROUPD': 'CRO',
};

// Special crypto overrides for tokens not on Binance or with different tickers
const CRYPTO_OVERRIDES: Record<string, string> = {
  'WBTCUSD': 'BINANCE:WBTCUSDT',
  'WBTC': 'BINANCE:WBTCUSDT',
  'STETHUSD': 'OKX:STETHUSD',
  'STETH': 'OKX:STETHUSDT',
  'OKBUSD': 'OKX:OKBUSDT',
  'OKB': 'OKX:OKBUSDT',
  'CROUSD': 'OKX:CROUSDT',
  'CRO': 'OKX:CROUSDT',
  'RNDRUSD': 'BINANCE:RNDRUSDT',
  'RNDR': 'BINANCE:RNDRUSDT',
};

/**
 * Resolve symbol to TradingView format based on asset category
 */
export function resolveTVSymbol(asset: Asset): string {
  let symbol = asset.symbol.trim().toUpperCase();
  const category = asset.category?.toLowerCase() || 'crypto';

  // Handle Forex pairs
  if (category === 'forex') {
    const tvSymbol = `FX:${symbol}`;
    console.debug('TradingView symbol resolved (forex)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Handle Commodities
  if (category === 'commodity') {
    const commodityMap: Record<string, string> = {
      'XAUUSD': 'OANDA:XAUUSD',  // Gold
      'XAGUSD': 'OANDA:XAGUSD',  // Silver
      'XPTUSD': 'OANDA:XPTUSD',  // Platinum
      'USOIL': 'TVC:USOIL',       // Crude Oil WTI
      'UKOIL': 'TVC:UKOIL',       // Brent Oil
      'NATGAS': 'NYMEX:NG1!',     // Natural Gas
    };
    const tvSymbol = commodityMap[symbol] || `TVC:${symbol}`;
    console.debug('TradingView symbol resolved (commodity)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Handle Indices
  if (category === 'index') {
    const indexMap: Record<string, string> = {
      'US500': 'TVC:SPX',         // S&P 500
      'US100': 'NASDAQ:NDX',      // NASDAQ 100
      'US30': 'DJ:DJI',           // Dow Jones
      'GER40': 'XETR:DAX',        // DAX
      'UK100': 'TVC:UKX',         // FTSE 100
      'JPN225': 'TVC:NI225',      // Nikkei 225
      'FRA40': 'EURONEXT:PX1',    // CAC 40
      'AUS200': 'ASX:XJO',        // ASX 200
    };
    const tvSymbol = indexMap[symbol] || `TVC:${symbol}`;
    console.debug('TradingView symbol resolved (index)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Handle Stocks
  if (category === 'stock') {
    // Major tech stocks are typically on NASDAQ
    const nasdaqStocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'];
    const exchange = nasdaqStocks.includes(symbol) ? 'NASDAQ' : 'NYSE';
    
    const tvSymbol = `${exchange}:${symbol}`;
    console.debug('TradingView symbol resolved (stock)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Handle Crypto (default category)
  // Apply normalizations first
  if (CRYPTO_TICKER_NORMALIZATIONS[symbol]) {
    symbol = CRYPTO_TICKER_NORMALIZATIONS[symbol];
  }

  // Check for explicit overrides first
  if (CRYPTO_OVERRIDES[symbol]) {
    const tvSymbol = CRYPTO_OVERRIDES[symbol];
    console.debug('TradingView symbol resolved (crypto override)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Strip USD/USDT suffix to get base token
  let token = symbol.replace(/USD$|USDT$/, '');
  
  // Apply ticker normalization
  if (CRYPTO_TICKER_NORMALIZATIONS[token]) {
    token = CRYPTO_TICKER_NORMALIZATIONS[token];
  }

  // Check override again after normalization
  if (CRYPTO_OVERRIDES[token]) {
    const tvSymbol = CRYPTO_OVERRIDES[token];
    console.debug('TradingView symbol resolved (crypto override normalized)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Default: BINANCE exchange with USDT pair
  const tvSymbol = `BINANCE:${token}USDT`;
  console.debug('TradingView symbol resolved (crypto)', { appSymbol: symbol, tvSymbol });
  return tvSymbol;
}
