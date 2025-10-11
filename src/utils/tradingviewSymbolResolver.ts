/**
 * TradingView Symbol Resolver - Crypto Only
 * Maps crypto symbols to TradingView BINANCE exchange format
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
 * Resolve crypto symbol to TradingView format (BINANCE:XXXUSDT)
 */
export function resolveTVSymbol(asset: Asset): string {
  let symbol = asset.symbol.trim().toUpperCase();

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
