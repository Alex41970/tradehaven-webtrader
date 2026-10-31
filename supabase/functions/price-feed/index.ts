// Scheduled price feed (runs every minute).
// Free sources first: Binance (crypto) and Yahoo batch quotes (forex, metals, energy, indices, stocks).
// Fallbacks: Coinbase for crypto, Twelve Data (free tier, capped per run) for forex/metals.
// Writes prices + 5-minute candles, then runs server-side SL/TP and stop-out checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';

type Asset = { symbol: string; category: string; api_source: string | null; api_symbol: string | null };
type Quote = { symbol: string; price: number; change?: number; source: string };
type Candle = { symbol: string; t: number; o: number; h: number; l: number; c: number };

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; TradeHavenPriceFeed/1.0)' };
const TIMEOUT_MS = 8000;
const TWELVE_DATA_MAX_PER_RUN = 8; // free tier: 8 credits / minute
const BACKFILL_PER_RUN = 8;
const HISTORY_DAYS = 30;

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`HTTP ${res.status} from ${new URL(url).host}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`Request failed for ${new URL(url).host}: ${(e as Error).message}`);
    return null;
  }
}

const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const binanceSymbol = (a: Asset) => (a.api_symbol || a.symbol.replace(/USD$/, 'USDT')).toUpperCase();
const yahooSymbol = (a: Asset) => a.api_symbol || a.symbol;

async function fetchBinance(assets: Asset[]): Promise<Quote[]> {
  if (!assets.length) return [];
  const bySym = new Map(assets.map((a) => [binanceSymbol(a), a.symbol]));
  const param = encodeURIComponent(JSON.stringify([...bySym.keys()]));
  for (const host of ['https://data-api.binance.vision', 'https://api.binance.com']) {
    // Binance rejects the whole batch if one symbol is unknown, so fall back to per-symbol on error
    const data = await getJson(`${host}/api/v3/ticker/24hr?symbols=${param}&type=MINI`);
    if (Array.isArray(data)) {
      return data
        .map((d: any) => {
          const price = Number(d.lastPrice);
          const open = Number(d.openPrice);
          return { symbol: bySym.get(d.symbol)!, price, change: open > 0 ? ((price - open) / open) * 100 : undefined, source: 'binance' };
        })
        .filter((q) => q.symbol && valid(q.price));
    }
  }
  const out: Quote[] = [];
  await Promise.all(
    [...bySym.entries()].map(async ([bs, sym]) => {
      const d = await getJson(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${bs}`);
      const price = Number(d?.price);
      if (valid(price)) out.push({ symbol: sym, price, source: 'binance' });
    }),
  );
  return out;
}

async function fetchCoinbase(assets: Asset[]): Promise<Quote[]> {
  const out: Quote[] = [];
  await Promise.all(
    assets.slice(0, 20).map(async (a) => {
      const base = a.symbol.replace(/USD$/, '');
      const d = await getJson(`https://api.coinbase.com/v2/prices/${base}-USD/spot`);
      const price = Number(d?.data?.amount);
      if (valid(price)) out.push({ symbol: a.symbol, price, source: 'coinbase' });
    }),
  );
  return out;
}

async function fetchYahoo(assets: Asset[], withHistory = false): Promise<{ quotes: Quote[]; candles: Candle[] }> {
  const quotes: Quote[] = [];
  const candles: Candle[] = [];
  const bySym = new Map(assets.map((a) => [yahooSymbol(a), a.symbol]));
  const keys = [...bySym.keys()];
  for (let i = 0; i < keys.length; i += 20) {
    const chunk = keys.slice(i, i + 20).map(encodeURIComponent).join(',');
    const range = withHistory ? '5d' : '1d';
    let data = null;
    for (const host of ['query2', 'query1']) {
      data = await getJson(`https://${host}.finance.yahoo.com/v7/finance/spark?symbols=${chunk}&range=${range}&interval=5m`);
      if (data?.spark?.result) break;
    }
    for (const r of data?.spark?.result ?? []) {
      const resp = r?.response?.[0];
      const meta = resp?.meta;
      const sym = bySym.get(r.symbol);
      if (!sym || !meta) continue;
      const price = Number(meta.regularMarketPrice);
      const prev = Number(meta.chartPreviousClose ?? meta.previousClose);
      if (valid(price)) {
        quotes.push({ symbol: sym, price, change: valid(prev) ? ((price - prev) / prev) * 100 : undefined, source: 'yahoo' });
      }
      if (withHistory) {
        const ts: number[] = resp.timestamp ?? [];
        const closes: number[] = resp.indicators?.quote?.[0]?.close ?? [];
        let last: number | null = null;
        ts.forEach((t, idx) => {
          const c = closes[idx];
          if (!valid(c)) return;
          const o = last ?? c;
          candles.push({ symbol: sym, t: Math.floor(t / 300) * 300, o, h: Math.max(o, c), l: Math.min(o, c), c });
          last = c;
        });
      }
    }
  }
  return { quotes, candles };
}

function twelveDataSymbol(a: Asset): string | null {
  if (a.category === 'forex' && a.symbol.length === 6) return `${a.symbol.slice(0, 3)}/${a.symbol.slice(3)}`;
  if (['XAUUSD', 'XAGUSD', 'XPTUSD'].includes(a.symbol)) return `${a.symbol.slice(0, 3)}/USD`;
  return null;
}

async function fetchTwelveData(assets: Asset[]): Promise<Quote[]> {
  const key = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!key) return [];
  const map = new Map<string, string>();
  for (const a of assets) {
    const s = twelveDataSymbol(a);
    if (s && map.size < TWELVE_DATA_MAX_PER_RUN) map.set(s, a.symbol);
  }
  if (!map.size) return [];
  const data = await getJson(`https://api.twelvedata.com/price?symbol=${encodeURIComponent([...map.keys()].join(','))}&apikey=${key}`);
  if (!data) return [];
  const entries: [string, any][] = map.size === 1 ? [[[...map.keys()][0], data]] : Object.entries(data);
  return entries
    .map(([s, v]) => ({ symbol: map.get(s)!, price: Number(v?.price), source: 'twelvedata' }))
    .filter((q) => q.symbol && valid(q.price));
}

async function binanceHistory(a: Asset): Promise<Candle[]> {
  const out: Candle[] = [];
  let start = Date.now() - HISTORY_DAYS * 86400_000;
  for (let i = 0; i < 10 && start < Date.now(); i++) {
    const d = await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol(a)}&interval=5m&limit=1000&startTime=${start}`);
    if (!Array.isArray(d) || !d.length) break;
    for (const k of d) out.push({ symbol: a.symbol, t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4] });
    start = d[d.length - 1][0] + 300_000;
    if (d.length < 1000) break;
  }
  return out;
}

async function yahooHistory(a: Asset): Promise<Candle[]> {
  let r = null;
  for (const host of ['query2', 'query1']) {
    const d = await getJson(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(a))}?interval=5m&range=${HISTORY_DAYS}d`);
    r = d?.chart?.result?.[0];
    if (r) break;
  }
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  ts.forEach((t, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (valid(o) && valid(h) && valid(l) && valid(c)) out.push({ symbol: a.symbol, t: Math.floor(t / 300) * 300, o, h, l, c });
  });
  return out;
}

Deno.serve(async (request) => {
  const authFailure = authenticateCronRequest(request);
  if (authFailure) return authFailure;

  const started = Date.now();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: assets, error } = await supabase
    .from('assets')
    .select('symbol, category, api_source, api_symbol')
    .eq('is_active', true);
  if (error || !assets) {
    console.error('Could not load assets', error?.message);
    return Response.json({ success: false }, { status: 500 });
  }

  const crypto = assets.filter((a) => a.category === 'crypto');
  const other = assets.filter((a) => a.category !== 'crypto');

  const [cryptoQuotes, yahoo] = await Promise.all([fetchBinance(crypto), fetchYahoo(other)]);
  const quotes = new Map<string, Quote>();
  [...cryptoQuotes, ...yahoo.quotes].forEach((q) => quotes.set(q.symbol, q));

  // Fallbacks only for what is still missing
  const missingCrypto = crypto.filter((a) => !quotes.has(a.symbol));
  const missingOther = other.filter((a) => !quotes.has(a.symbol));
  const [cb, td] = await Promise.all([fetchCoinbase(missingCrypto), fetchTwelveData(missingOther)]);
  [...cb, ...td].forEach((q) => quotes.set(q.symbol, q));

  const list = [...quotes.values()].map((q) => ({
    symbol: q.symbol,
    price: q.price,
    change: q.change != null && Number.isFinite(q.change) ? Number(q.change.toFixed(4)) : '',
    source: q.source,
  }));

  let stored = 0;
  if (list.length) {
    const { data: n, error: ingestError } = await supabase.rpc('ingest_prices', { _prices: list });
    if (ingestError) console.error('ingest_prices failed', ingestError.message);
    stored = (n as number) ?? 0;
  }

  // Server-side SL/TP and margin call / stop-out
  const { data: triggers, error: trigErr } = await supabase.rpc('process_price_triggers');
  if (trigErr) console.error('process_price_triggers failed', trigErr.message);

  // Backfill chart history for a few symbols that have little of it
  let backfilled = 0;
  // Markets without real history back to ~HISTORY_DAYS get filled (a few per run)
  const since = new Date(Date.now() - (HISTORY_DAYS - 3) * 86400_000).toISOString();
  const { data: missingRows, error: mhErr } = await supabase.rpc('symbols_missing_history', { _since: since });
  if (mhErr) console.error('symbols_missing_history failed', mhErr.message);
  const missingSet = new Set(((missingRows as { symbol: string }[]) ?? []).map((r) => r.symbol));
  const needHistory = (assets as Asset[]).filter((a) => missingSet.has(a.symbol)).slice(0, BACKFILL_PER_RUN);
  if (needHistory.length) {
    const hist: Candle[] = [];
    const parts = await Promise.all(needHistory.map((a) => (a.category === 'crypto' ? binanceHistory(a) : yahooHistory(a))));
    parts.forEach((p) => hist.push(...p));
    // De-duplicate buckets
    const uniq = new Map(hist.map((c) => [`${c.symbol}|${c.t}`, c]));
    if (uniq.size) {
      const { data: n } = await supabase.rpc('backfill_candles', { _candles: [...uniq.values()] });
      backfilled = (n as number) ?? 0;
    }
  }

  // Keep HISTORY_DAYS of candles (once an hour)
  if (new Date().getUTCMinutes() === 0) {
    await supabase.from('price_candles').delete().lt('bucket', new Date(Date.now() - (HISTORY_DAYS + 1) * 86400_000).toISOString());
  }

  const missing = assets.filter((a) => !quotes.has(a.symbol)).map((a) => a.symbol);
  const bySource = list.reduce<Record<string, number>>((m, q) => ((m[q.source] = (m[q.source] ?? 0) + 1), m), {});
  console.log(`💾 ${stored}/${assets.length} prices stored ${JSON.stringify(bySource)} in ${Date.now() - started}ms; missing: ${missing.join(',') || 'none'}; backfilled ${backfilled}; triggers ${JSON.stringify(triggers)}`);

  return Response.json({ success: true, stored, total: assets.length, bySource, missing, backfilled, triggers });
});
