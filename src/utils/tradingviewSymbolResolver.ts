/**
 * TradingView Symbol Resolver
 * Maps application asset symbols to correct TradingView exchange:symbol format
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
  'CROUPD': 'CRO', // Fix typo
  'TSMC': 'TSM', // Stock normalization
};

// Explicit index mappings
const INDEX_MAPPINGS: Record<string, string> = {
  'SPX500': 'TVC:SPX',
  'NAS100': 'TVC:NDX',
  'US30': 'TVC:DJI',
  'DJ30': 'TVC:DJI',
  'RUSSELL2000': 'TVC:RUT',
  'GER40': 'TVC:DAX',
  'UK100': 'TVC:UKX',
  'FRA40': 'TVC:CAC',
  'ESP35': 'TVC:IBEX',
  'EUSTX50': 'TVC:SX5E',
  'STOXX50': 'TVC:SX5E',
  'JPN225': 'TVC:NI225',
  'CHINA50': 'TVC:CHINA50',
  'HK50': 'TVC:HSI',
  'INDIA50': 'TVC:NIFTY',
  'AUS200': 'TVC:AS51',
};

// Explicit commodity mappings
const COMMODITY_MAPPINGS: Record<string, string> = {
  // Precious metals (spot)
  'XAUUSD': 'TVC:GOLD',
  'XAGUSD': 'TVC:SILVER',
  'XPTUSD': 'TVC:PLATINUM',
  'XPDUSD': 'TVC:PALLADIUM',
  
  // Base metals
  'XCUUSD': 'COMEX:HG1!',
  'COPPER': 'COMEX:HG1!',
  'XALUSD': 'COMEX:ALI1!',
  'XZNCUSD': 'COMEX:ZNC1!',
  'XNIUSD': 'LME:NI1!',
  
  // Energy
  'WTIUSD': 'TVC:USOIL',
  'USOIL': 'TVC:USOIL',
  'BCOUSD': 'TVC:UKOIL',
  'UKOIL': 'TVC:UKOIL',
  'BRUSD': 'TVC:UKOIL',
  'NATGAS': 'TVC:NATURALGAS',
  'NATGASUSD': 'TVC:NATURALGAS',
  
  // Agriculture futures
  'WHEAT': 'CBOT:ZW1!',
  'CORN': 'CBOT:ZC1!',
  'SOYBEAN': 'CBOT:ZS1!',
  'COFFEE': 'ICEUS:KC1!',
  'COCOA': 'ICEUS:CC1!',
  'SUGAR': 'ICEUS:SB1!',
  'COTTON': 'ICEUS:CT1!',
  'ORANGE': 'ICEUS:OJ1!',
  'CATTLE': 'CME:LE1!',
  'HOGS': 'CME:HE1!',
  'LUMBER': 'CME:LBS1!',
};

// Explicit stock exchange mappings (NASDAQ vs NYSE)
const STOCK_EXCHANGE_MAP: Record<string, string> = {
  // NASDAQ
  'AAPL': 'NASDAQ',
  'ADBE': 'NASDAQ',
  'AMD': 'NASDAQ',
  'AMZN': 'NASDAQ',
  'AMGN': 'NASDAQ',
  'CSCO': 'NASDAQ',
  'COST': 'NASDAQ',
  'GILD': 'NASDAQ',
  'INTC': 'NASDAQ',
  'META': 'NASDAQ',
  'MSFT': 'NASDAQ',
  'NFLX': 'NASDAQ',
  'NVDA': 'NASDAQ',
  'PYPL': 'NASDAQ',
  'QCOM': 'NASDAQ',
  'SBUX': 'NASDAQ',
  'TSLA': 'NASDAQ',
  'GOOGL': 'NASDAQ',
  'BKNG': 'NASDAQ',
  'PEP': 'NASDAQ',
  'LYFT': 'NASDAQ',
  'ORCL': 'NASDAQ',
  'SNAP': 'NASDAQ',
  'SQ': 'NASDAQ',
  'SHOP': 'NASDAQ',
  'UBER': 'NASDAQ',
  'PINS': 'NASDAQ',
  'AXP': 'NASDAQ',
  
  // NYSE
  'ABBV': 'NYSE',
  'BAC': 'NYSE',
  'BK': 'NYSE',
  'BMY': 'NYSE',
  'C': 'NYSE',
  'COP': 'NYSE',
  'CRM': 'NYSE',
  'CVS': 'NYSE',
  'CVX': 'NYSE',
  'DIS': 'NYSE',
  'GS': 'NYSE',
  'HD': 'NYSE',
  'IBM': 'NYSE',
  'JNJ': 'NYSE',
  'JPM': 'NYSE',
  'KO': 'NYSE',
  'LLY': 'NYSE',
  'LOW': 'NYSE',
  'MA': 'NYSE',
  'MCD': 'NYSE',
  'MRK': 'NYSE',
  'MS': 'NYSE',
  'NKE': 'NYSE',
  'PFE': 'NYSE',
  'PG': 'NYSE',
  'PNC': 'NYSE',
  'SLB': 'NYSE',
  'TGT': 'NYSE',
  'TJX': 'NYSE',
  'TMO': 'NYSE',
  'TSM': 'NYSE', // TSMC normalized to TSM
  'UNH': 'NYSE',
  'USB': 'NYSE',
  'V': 'NYSE',
  'WFC': 'NYSE',
  'WMT': 'NYSE',
  'XOM': 'NYSE',
};

// Special crypto overrides for tokens not on major exchanges or with different tickers
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
 * Resolve application asset symbol to TradingView symbol
 */
export function resolveTVSymbol(asset: Asset): string {
  let symbol = asset.symbol.trim().toUpperCase();
  const category = asset.category?.toLowerCase();

  // Apply normalizations first
  if (CRYPTO_TICKER_NORMALIZATIONS[symbol]) {
    symbol = CRYPTO_TICKER_NORMALIZATIONS[symbol];
  }

  // 1. INDICES - Explicit mappings
  if (category === 'indices' || INDEX_MAPPINGS[symbol]) {
    const mapped = INDEX_MAPPINGS[symbol];
    if (mapped) {
      console.debug('TradingView symbol resolved (index)', { appSymbol: symbol, tvSymbol: mapped });
      return mapped;
    }
  }

  // 2. COMMODITIES - Explicit mappings
  if (category === 'commodities' || COMMODITY_MAPPINGS[symbol]) {
    const mapped = COMMODITY_MAPPINGS[symbol];
    if (mapped) {
      console.debug('TradingView symbol resolved (commodity)', { appSymbol: symbol, tvSymbol: mapped });
      return mapped;
    }
  }

  // 3. STOCKS - Use exchange mapping
  if (category === 'stocks' || STOCK_EXCHANGE_MAP[symbol]) {
    const exchange = STOCK_EXCHANGE_MAP[symbol] || 'NASDAQ'; // Default to NASDAQ
    const tvSymbol = `${exchange}:${symbol}`;
    console.debug('TradingView symbol resolved (stock)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // 4. CRYPTO - Use binance with fallbacks
  if (category === 'crypto') {
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

    // Try BINANCE first (most liquid)
    const tvSymbol = `BINANCE:${token}USDT`;
    console.debug('TradingView symbol resolved (crypto)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // 5. FOREX - Use FX_IDC for reliable coverage
  if (category === 'forex') {
    // Remove USD suffix if present to get pair
    const pair = symbol.replace(/USD$/, '');
    // Reconstruct pair - if it's already a 6-char pair, use as-is
    const forexPair = pair.length === 6 ? pair : symbol;
    const tvSymbol = `FX_IDC:${forexPair}`;
    console.debug('TradingView symbol resolved (forex)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Default fallback based on symbol pattern
  if (symbol.length === 6 && !symbol.includes('USD')) {
    // Likely a forex pair (EURUSD, GBPJPY, etc.)
    const tvSymbol = `FX_IDC:${symbol}`;
    console.debug('TradingView symbol resolved (forex fallback)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  if (symbol.endsWith('USD') && symbol.length > 6) {
    // Likely crypto
    const token = symbol.replace(/USD$/, '');
    const tvSymbol = `BINANCE:${token}USDT`;
    console.debug('TradingView symbol resolved (crypto fallback)', { appSymbol: symbol, tvSymbol });
    return tvSymbol;
  }

  // Last resort: try forex
  const tvSymbol = `FX_IDC:${symbol}`;
  console.warn('TradingView symbol fallback used', { appSymbol: symbol, tvSymbol });
  return tvSymbol;
}
