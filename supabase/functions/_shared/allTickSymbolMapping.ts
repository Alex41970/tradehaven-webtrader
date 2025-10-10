// Single source of truth for AllTick symbol mappings
// Maps internal symbol → AllTick API code
// Total: 100 symbols (AllTick plan limit)

export const ALLTICK_SYMBOL_MAPPING = new Map([
  // === FOREX (30 pairs) ===
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
  ['AUDJPY', 'AUDJPY'],
  ['CADJPY', 'CADJPY'],
  ['CHFJPY', 'CHFJPY'],
  ['EURAUD', 'EURAUD'],
  ['EURCAD', 'EURCAD'],
  ['EURCHF', 'EURCHF'],
  ['EURNZD', 'EURNZD'],
  ['GBPAUD', 'GBPAUD'],
  ['GBPCAD', 'GBPCAD'],
  ['GBPCHF', 'GBPCHF'],
  ['GBPNZD', 'GBPNZD'],
  ['AUDCAD', 'AUDCAD'],
  ['AUDCHF', 'AUDCHF'],
  ['AUDNZD', 'AUDNZD'],
  ['CADCHF', 'CADCHF'],
  ['NZDCAD', 'NZDCAD'],
  ['NZDCHF', 'NZDCHF'],
  ['NZDJPY', 'NZDJPY'],
  ['USDMXN', 'USDMXN'],
  ['USDZAR', 'USDZAR'],
  
  // === CRYPTO (30 coins) ===
  ['BTCUSD', 'BTCUSDT'],
  ['ETHUSD', 'ETHUSDT'],
  ['XRPUSD', 'XRPUSDT'],
  ['ADAUSD', 'ADAUSDT'],
  ['SOLUSD', 'SOLUSDT'],
  ['DOTUSD', 'DOTUSDT'],
  ['DOGEUSD', 'DOGEUSDT'],
  ['MATICUSD', 'MATICUSDT'],
  ['AVAXUSD', 'AVAXUSDT'],
  ['UNIUSD', 'UNIUSDT'],
  ['LINKUSD', 'LINKUSDT'],
  ['LTCUSD', 'LTCUSDT'],
  ['BCHUSD', 'BCHUSDT'],
  ['ATOMUSD', 'ATOMUSDT'],
  ['XLMUSD', 'XLMUSDT'],
  ['ALGOUSD', 'ALGOUSDT'],
  ['VETUSD', 'VETUSDT'],
  ['ICPUSD', 'ICPUSDT'],
  ['FILUSD', 'FILUSDT'],
  ['TRXUSD', 'TRXUSDT'],
  ['ETCUSD', 'ETCUSDT'],
  ['NEARUSD', 'NEARUSDT'],
  ['APTUSD', 'APTUSDT'],
  ['QNTUSD', 'QNTUSDT'],
  ['OPUSD', 'OPUSDT'],
  ['ARBUSD', 'ARBUSDT'],
  ['LDOUSD', 'LDOUSDT'],
  ['INJUSD', 'INJUSDT'],
  ['SANDUSD', 'SANDUSDT'],
  ['MANAUSD', 'MANAUSDT'],
  
  // === COMMODITIES (15) ===
  ['XAUUSD', 'XAUUSD'],  // Gold
  ['XAGUSD', 'XAGUSD'],  // Silver
  ['WTIUSD', 'WTIUSD'],  // WTI Crude Oil
  ['BCOUSD', 'BCOUSD'],  // Brent Crude Oil (changed from BRUSD)
  ['XPTUSD', 'XPTUSD'],  // Platinum
  ['XPDUSD', 'XPDUSD'],  // Palladium
  ['COPUSD', 'XCOPUSD'], // Copper (changed to XCOPUSD)
  ['GSUSD', 'NGUSD'],    // Natural Gas (changed from GSUSD)
  ['CORNUSD', 'CORNUSD'], // Corn
  ['WHEATUSD', 'WHEATUSD'], // Wheat
  ['SOYUSD', 'SOYUSD'],  // Soybeans
  ['COFFEEUSD', 'COFFEEUSD'], // Coffee
  ['COTTONUSD', 'COTTONUSD'], // Cotton
  ['SUGARUSD', 'SUGARUSD'], // Sugar
  ['COCOAUSD', 'COCOAUSD'], // Cocoa
  
  // === STOCKS (20 US) ===
  ['AAPL', 'AAPL.US'],
  ['GOOGL', 'GOOGL.US'],
  ['MSFT', 'MSFT.US'],
  ['AMZN', 'AMZN.US'],
  ['META', 'META.US'],
  ['TSLA', 'TSLA.US'],
  ['NVDA', 'NVDA.US'],
  ['JPM', 'JPM.US'],
  ['V', 'V.US'],
  ['WMT', 'WMT.US'],
  ['JNJ', 'JNJ.US'],
  ['PG', 'PG.US'],
  ['MA', 'MA.US'],
  ['HD', 'HD.US'],
  ['BAC', 'BAC.US'],
  ['DIS', 'DIS.US'],
  ['NFLX', 'NFLX.US'],
  ['ADBE', 'ADBE.US'],
  ['CRM', 'CRM.US'],
  ['PYPL', 'PYPL.US'],
  
  // === INDICES (5) ===
  ['SPX500', 'SPX500.IDX'],  // S&P 500
  ['NAS100', 'NAS100.IDX'],  // Nasdaq 100
  ['US30', 'US30.IDX'],      // Dow Jones
  ['UK100', 'UK100.IDX'],    // FTSE 100
  ['JPN225', 'JPN225.IDX'],  // Nikkei 225
]);

// Helper functions
export const getInternalSymbol = (allTickCode: string): string | undefined => {
  for (const [internal, code] of ALLTICK_SYMBOL_MAPPING.entries()) {
    if (code === allTickCode) return internal;
  }
  return undefined;
};

export const getAllTickCode = (internalSymbol: string): string | undefined => {
  return ALLTICK_SYMBOL_MAPPING.get(internalSymbol);
};

export const getAllTickSymbols = (): string[] => {
  return Array.from(ALLTICK_SYMBOL_MAPPING.values());
};

export const getInternalSymbols = (): string[] => {
  return Array.from(ALLTICK_SYMBOL_MAPPING.keys());
};

export const isSymbolSupported = (internalSymbol: string): boolean => {
  return ALLTICK_SYMBOL_MAPPING.has(internalSymbol);
};

export const getSymbolCount = (): number => {
  return ALLTICK_SYMBOL_MAPPING.size;
};
