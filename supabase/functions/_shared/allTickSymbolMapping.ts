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
  ['USDSEK', 'USDSEK'],  // USD/Swedish Krona
  
  // === CRYPTO (38 coins) ===
  ['BTCUSD', 'BTCUSDT'],
  ['ETHUSD', 'ETHUSDT'],
  ['XRPUSD', 'XRPUSDT'],
  ['ADAUSD', 'ADAUSDT'],
  ['SOLUSD', 'SOLUSDT'],
  ['DOTUSD', 'DOTUSDT'],
  ['DOGEUSD', 'DOGEUSDT'],
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
  ['BNBUSD', 'BNBUSDT'],     // Binance Coin
  ['SHIBUSD', 'SHIBUSDT'],  // Shiba Inu
  ['PEPEUSD', 'PEPEUSDT'],  // Pepe
  ['RNDRUSD', 'RNDRUSDT'],  // Render
  ['GRTUSD', 'GRTUSDT'],     // The Graph
  ['AAVEUSD', 'AAVEUSDT'],  // Aave
  ['TONUSD', 'TONUSDT'],    // Toncoin
  ['SUIUSD', 'SUIUSDT'],    // Sui
  ['HBARUSD', 'HBARUSDT'],  // Hedera
  
  // === COMMODITIES (3) ===
  ['XAUUSD', 'XAUUSD'],  // Gold
  ['XAGUSD', 'Silver'],  // Silver (AllTick uses "Silver")
  ['WTIUSD', 'USOIL'],   // WTI Crude Oil (AllTick uses "USOIL")
  ['BCOUSD', 'UKOIL'],   // Brent Crude Oil (AllTick uses "UKOIL")
  
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
  ['SPX500', 'US500'],   // S&P 500
  ['NAS100', 'NAS100'],  // Nasdaq 100
  ['US30', 'US30'],      // Dow Jones
  ['UK100', 'UK100'],    // FTSE 100
  ['JPN225', 'JPN225'],  // Nikkei 225
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
