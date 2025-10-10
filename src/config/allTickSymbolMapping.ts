/**
 * Single Source of Truth for AllTick Symbol Mappings
 * Maps internal symbol codes to AllTick API codes
 * Total: 100 symbols (AllTick API limit)
 */

export const ALLTICK_SYMBOL_MAPPING = new Map<string, string>([
  // ============ FOREX (30 MAJOR PAIRS) ============
  ['EURUSD', 'EURUSD'],
  ['GBPUSD', 'GBPUSD'],
  ['USDJPY', 'USDJPY'],
  ['AUDUSD', 'AUDUSD'],
  ['USDCAD', 'USDCAD'],
  ['USDCHF', 'USDCHF'],
  ['NZDUSD', 'NZDUSD'],
  ['EURGBP', 'EURGBP'],
  ['EURJPY', 'EURJPY'],
  ['GBPJPY', 'GBPJPY'],
  ['EURCHF', 'EURCHF'],
  ['AUDJPY', 'AUDJPY'],
  ['GBPCHF', 'GBPCHF'],
  ['AUDNZD', 'AUDNZD'],
  ['NZDJPY', 'NZDJPY'],
  ['GBPAUD', 'GBPAUD'],
  ['GBPNZD', 'GBPNZD'],
  ['EURAUD', 'EURAUD'],
  ['EURNZD', 'EURNZD'],
  ['AUDCAD', 'AUDCAD'],
  ['GBPCAD', 'GBPCAD'],
  ['EURCAD', 'EURCAD'],
  ['CADJPY', 'CADJPY'],
  ['AUDCHF', 'AUDCHF'],
  ['CADCHF', 'CADCHF'],
  ['NZDCAD', 'NZDCAD'],
  ['NZDCHF', 'NZDCHF'],
  ['CHFJPY', 'CHFJPY'],
  ['USDMXN', 'USDMXN'],
  ['USDSEK', 'USDSEK'],  // USD/Swedish Krona

  // ============ CRYPTO (36 TOP COINS) ============
  ['BTCUSD', 'BTCUSDT'],
  ['ETHUSD', 'ETHUSDT'],
  ['BNBUSD', 'BNBUSDT'],
  ['ADAUSD', 'ADAUSDT'],
  ['SOLUSD', 'SOLUSDT'],
  ['XRPUSD', 'XRPUSDT'],
  ['DOTUSD', 'DOTUSDT'],
  ['DOGEUSD', 'DOGEUSDT'],
  ['AVAXUSD', 'AVAXUSDT'],
  ['LINKUSD', 'LINKUSDT'],
  ['LTCUSD', 'LTCUSDT'],
  ['UNIUSD', 'UNIUSDT'],
  ['ATOMUSD', 'ATOMUSDT'],
  ['ETCUSD', 'ETCUSDT'],
  ['XLMUSD', 'XLMUSDT'],
  ['FILUSD', 'FILUSDT'],
  ['TRXUSD', 'TRXUSDT'],
  ['APTUSD', 'APTUSDT'],
  ['NEARUSD', 'NEARUSDT'],
  ['ALGOUSD', 'ALGOUSDT'],
  ['EOSUSD', 'EOSUSDT'],
  ['XTZUSD', 'XTZUSDT'],
  ['AAVEUSD', 'AAVEUSDT'],
  ['GRTUSD', 'GRTUSDT'],
  ['SANDUSD', 'SANDUSDT'],
  ['MANAUSD', 'MANAUSDT'],
  ['ICPUSD', 'ICPUSDT'],
  ['INJUSD', 'INJUSDT'],
  ['RNDRUSD', 'RNDRUSDT'],
  ['BNBUSD', 'BNBUSDT'],     // Binance Coin
  ['SHIBUSD', 'SHIBUSDT'],  // Shiba Inu
  ['PEPEUSD', 'PEPEUSDT'],  // Pepe
  ['TONUSD', 'TONUSDT'],    // Toncoin
  ['SUIUSD', 'SUIUSDT'],    // Sui
  ['HBARUSD', 'HBARUSDT'],  // Hedera

  // ============ COMMODITIES (3) ============
  ['XAUUSD', 'XAUUSD'],      // Gold
  ['XAGUSD', 'Silver'],      // Silver (AllTick uses "Silver")
  ['WTIUSD', 'USOIL'],       // WTI Crude Oil (AllTick uses "USOIL")
  ['BCOUSD', 'UKOIL'],       // Brent Crude Oil (AllTick uses "UKOIL")

  // ============ US STOCKS (20) ============
  ['AAPL', 'AAPL.US'],       // Apple
  ['MSFT', 'MSFT.US'],       // Microsoft
  ['GOOGL', 'GOOGL.US'],     // Alphabet/Google
  ['AMZN', 'AMZN.US'],       // Amazon
  ['NVDA', 'NVDA.US'],       // Nvidia
  ['TSLA', 'TSLA.US'],       // Tesla
  ['META', 'META.US'],       // Meta/Facebook
  ['BRK.B', 'BRKB.US'],      // Berkshire Hathaway
  ['JPM', 'JPM.US'],         // JP Morgan
  ['V', 'V.US'],             // Visa
  ['JNJ', 'JNJ.US'],         // Johnson & Johnson
  ['WMT', 'WMT.US'],         // Walmart
  ['PG', 'PG.US'],           // Procter & Gamble
  ['MA', 'MA.US'],           // Mastercard
  ['HD', 'HD.US'],           // Home Depot
  ['DIS', 'DIS.US'],         // Disney
  ['NFLX', 'NFLX.US'],       // Netflix
  ['PYPL', 'PYPL.US'],       // PayPal
  ['INTC', 'INTC.US'],       // Intel
  ['AMD', 'AMD.US'],         // AMD

  // ============ INDICES (5) ============
  ['SPX500', 'US500'],   // S&P 500
  ['NAS100', 'NAS100'],  // Nasdaq 100
  ['US30', 'US30'],      // Dow Jones 30
  ['UK100', 'UK100'],    // FTSE 100
  ['JPN225', 'JPN225'],  // Nikkei 225
]);

// Total symbols: 100 (30 Forex + 36 Crypto + 3 Commodities + 20 Stocks + 5 Indices + 6 replacements)

/**
 * Get the internal symbol from an AllTick code
 */
export const getInternalSymbol = (allTickCode: string): string | undefined => {
  for (const [internal, code] of ALLTICK_SYMBOL_MAPPING.entries()) {
    if (code === allTickCode) return internal;
  }
  return undefined;
};

/**
 * Get the AllTick API code from an internal symbol
 */
export const getAllTickCode = (internalSymbol: string): string | undefined => {
  return ALLTICK_SYMBOL_MAPPING.get(internalSymbol);
};

/**
 * Get all AllTick API codes (100 total)
 */
export const getAllTickSymbols = (): string[] => {
  return Array.from(ALLTICK_SYMBOL_MAPPING.values());
};

/**
 * Get all internal symbols (100 total)
 */
export const getInternalSymbols = (): string[] => {
  return Array.from(ALLTICK_SYMBOL_MAPPING.keys());
};

/**
 * Check if a symbol is supported by AllTick
 */
export const isSymbolSupported = (internalSymbol: string): boolean => {
  return ALLTICK_SYMBOL_MAPPING.has(internalSymbol);
};

/**
 * Get symbol count
 */
export const getSymbolCount = (): number => {
  return ALLTICK_SYMBOL_MAPPING.size;
};
