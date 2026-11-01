// Scheduled price feed (runs every minute, fetching 4 times inside each run, 15s apart).
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
const BACKFILL_PER_RUN = 16;
// Timing: each scheduled run (every minute) fetches PASSES times, PASS_GAP_MS apart.
const PASSES = 4;
const PASS_GAP_MS = 15_000;
// Provider budgets, kept at 70% of their limits so 30% is always free.
const SAFETY = 0.7;
const YAHOO_LIMIT_PER_MIN = 2000 / 60; // unofficial; ~2,000 calls/hour is the safe working figure
const YAHOO_CALLS_PER_MIN = Math.floor(YAHOO_LIMIT_PER_MIN * SAFETY); // 23
const YAHOO_BATCH = 20; // Yahoo spark rejects more than 20 symbols per call
const TWELVE_DATA_CALLS_PER_MIN = Math.floor(8 * SAFETY); // 5
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HISTORY_DAYS = 30;

// Per-run counters (reset at the start of every run; module state survives warm restarts)
const calls: Record<string, number> = {};
const errors: string[] = [];
const noteError = (msg: string) => { if (errors.length < 30) errors.push(msg); };
const provider = (host: string) =>
  host.includes('yahoo') ? 'yahoo' : host.includes('binance') ? 'binance' : host.includes('coinbase') ? 'coinbase' : host.includes('twelvedata') ? 'twelvedata' : host;

async function getJson(url: string): Promise<any | null> {
  const host = new URL(url).host;
  calls[provider(host)] = (calls[provider(host)] ?? 0) + 1;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`HTTP ${res.status} from ${host}`);
      noteError(`HTTP ${res.status} ${host}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`Request failed for ${host}: ${(e as Error).message}`);
    noteError(`${host}: ${(e as Error).message}`);
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

let yahooThrottled = false;
async function fetchYahoo(assets: Asset[], withHistory = false): Promise<{ quotes: Quote[]; candles: Candle[] }> {
  const quotes: Quote[] = [];
  const candles: Candle[] = [];
  const bySym = new Map(assets.map((a) => [yahooSymbol(a), a.symbol]));
  const keys = [...bySym.keys()];
  for (let i = 0; i < keys.length; i += YAHOO_BATCH) {
    if (yahooThrottled) break;
    const chunk = keys.slice(i, i + YAHOO_BATCH).map(encodeURIComponent).join(',');
    const range = withHistory ? '5d' : '1d';
    let data = null;
    for (const host of ['query2', 'query1']) {
      data = await getJson(`https://${host}.finance.yahoo.com/v7/finance/spark?symbols=${chunk}&range=${range}&interval=5m`);
      if (data?.spark?.result) break;
    }
    if (!data) yahooThrottled = true; // both hosts failed: back off for the rest of this run
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

async function fetchTwelveData(assets: Asset[], limit: number): Promise<Quote[]> {
  if (limit <= 0) return [];
  const key = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!key) return [];
  const map = new Map<string, string>();
  for (const a of assets) {
    const s = twelveDataSymbol(a);
    if (s && map.size < limit) map.set(s, a.symbol);
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
  yahooThrottled = false;
  for (const k of Object.keys(calls)) delete calls[k];
  errors.length = 0;
  const rejected: unknown[] = [];
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

  // Yahoo symbols rotate in chunks of 20 so the call budget is spread across passes.
  const chunks: Asset[][] = [];
  for (let i = 0; i < other.length; i += YAHOO_BATCH) chunks.push(other.slice(i, i + YAHOO_BATCH));
  // While some markets still lack chart history, keep a few Yahoo calls free for it
  // (still refreshes every market at least once a minute: 4 calls x 4 passes >= chunks).
  const { data: missingCount } = await supabase.rpc('symbols_missing_history', { _since: new Date(Date.now() - (HISTORY_DAYS - 3) * 86400_000).toISOString() });
  const historyPending = ((missingCount as unknown[]) ?? []).length > 0;
  const fullPerPass = Math.max(1, Math.floor(YAHOO_CALLS_PER_MIN / PASSES));
  const yahooPerPass = historyPending ? Math.max(1, Math.min(fullPerPass, Math.ceil(Math.ceil(other.length / YAHOO_BATCH) / PASSES))) : fullPerPass;
  const minute = Math.floor(started / 60_000);
  let tdBudget = TWELVE_DATA_CALLS_PER_MIN;

  const latest = new Map<string, Quote>();
  let stored = 0;
  const yahooUsed = () => calls.yahoo ?? 0;
  for (let pass = 0; pass < PASSES; pass++) {
    const passStart = started + pass * PASS_GAP_MS;
    if (Date.now() < passStart) await sleep(passStart - Date.now());

    const pick: Asset[] = [];
    if (chunks.length) {
      const n = Math.min(yahooPerPass, chunks.length);
      const offset = ((minute * PASSES + pass) * yahooPerPass) % chunks.length;
      for (let k = 0; k < n; k++) pick.push(...chunks[(offset + k) % chunks.length]);
    }

    // Never go over the Yahoo budget, counting fallback-host retries too
    const yahooRoom = Math.max(0, YAHOO_CALLS_PER_MIN - yahooUsed());
    const yahooPick = pick.slice(0, yahooRoom * YAHOO_BATCH);
    const [cryptoQuotes, yahoo] = await Promise.all([fetchBinance(crypto), yahooThrottled || !yahooPick.length ? { quotes: [] as Quote[] } : fetchYahoo(yahooPick)]);
    const quotes = new Map<string, Quote>();
    [...cryptoQuotes, ...yahoo.quotes].forEach((q) => quotes.set(q.symbol, q));

    // Fallbacks only for what is still missing
    const missingCrypto = crypto.filter((a) => !quotes.has(a.symbol));
    const missingOther = pick.filter((a) => !quotes.has(a.symbol));
    const tdLimit = Math.min(tdBudget, missingOther.length);
    const [cb, td] = await Promise.all([fetchCoinbase(missingCrypto), fetchTwelveData(missingOther, tdLimit)]);
    tdBudget -= td.length ? tdLimit : 0;
    [...cb, ...td].forEach((q) => quotes.set(q.symbol, q));

    const list = [...quotes.values()].map((q) => ({
      symbol: q.symbol,
      price: q.price,
      change: q.change != null && Number.isFinite(q.change) ? Number(q.change.toFixed(4)) : '',
      source: q.source,
    }));
    quotes.forEach((q, k) => latest.set(k, q));
    if (list.length) {
      const { data: res, error: ingestError } = await supabase.rpc('ingest_prices_v2', { _prices: list });
      if (ingestError) {
        console.error('ingest_prices failed', ingestError.message);
        noteError(`ingest: ${ingestError.message}`);
      }
      const r = res as { stored?: number; rejected?: { symbol: string }[] } | null;
      stored += r?.stored ?? 0;
      // Rejected outliers keep their old price and are not counted as updated
      for (const x of r?.rejected ?? []) {
        rejected.push(x);
        latest.delete(x.symbol);
      }
    }
    // SL/TP and stop-out on every pass so triggers follow the fresher prices
    if (pass < PASSES - 1) {
      const { error: e } = await supabase.rpc('process_price_triggers');
      if (e) { console.error('process_price_triggers failed', e.message); noteError(`triggers: ${e.message}`); }
    }
  }
  const quotes = latest;
  const list = [...latest.values()];

  // Server-side SL/TP and margin call / stop-out
  const { data: triggers, error: trigErr } = await supabase.rpc('process_price_triggers');
  if (trigErr) { console.error('process_price_triggers failed', trigErr.message); noteError(`triggers: ${trigErr.message}`); }

  // Backfill chart history for a few symbols that have little of it
  let backfilled = 0;
  // Markets without real history back to ~HISTORY_DAYS get filled (a few per run)
  const since = new Date(Date.now() - (HISTORY_DAYS - 3) * 86400_000).toISOString();
  const { data: missingRows, error: mhErr } = await supabase.rpc('symbols_missing_history', { _since: since });
  if (mhErr) console.error('symbols_missing_history failed', mhErr.message);
  const missingSet = new Set(((missingRows as { symbol: string }[]) ?? []).map((r) => r.symbol));
  const missingAssets = (assets as Asset[]).filter((a) => missingSet.has(a.symbol));
  // Crypto history comes from Binance (plenty of room); Yahoo history shares the Yahoo budget, so only a few per run.
  const needHistory = [
    ...missingAssets.filter((a) => a.category === 'crypto').slice(0, BACKFILL_PER_RUN),
    // Each Yahoo history fetch can cost 2 calls (fallback host)
    ...missingAssets.filter((a) => a.category !== 'crypto').slice(0, Math.floor(Math.max(0, YAHOO_CALLS_PER_MIN - yahooUsed()) / 2)),
  ];
  // Only backfill when this run still has time, so runs never pile up on top of each other
  if (needHistory.length && Date.now() - started < 52_000) {
    const hist: Candle[] = [];
    const parts = await Promise.all(needHistory.map((a) => (a.category === 'crypto' ? binanceHistory(a) : yahooHistory(a))));
    parts.forEach((p) => hist.push(...p));
    // De-duplicate buckets
    const uniq = new Map(hist.map((c) => [`${c.symbol}|${c.t}`, c]));
    if (uniq.size) {
      const all = [...uniq.values()];
      // Small batches: big ones hit the database statement timeout
      for (let i = 0; i < all.length && Date.now() - started < 58_000; i += 1500) {
        const { data: n, error: bfErr } = await supabase.rpc('backfill_candles', { _candles: all.slice(i, i + 1500) });
        if (bfErr) { console.error('backfill_candles failed', bfErr.message); noteError(`backfill: ${bfErr.message}`); }
        backfilled += (n as number) ?? 0;
      }
      console.log(`📈 history for ${needHistory.map((a) => a.symbol).join(',')}: ${all.length} candles`);
    }
  }

  // Keep HISTORY_DAYS of candles (once an hour)
  if (new Date().getUTCMinutes() === 0) {
    await supabase.from('price_candles').delete().lt('bucket', new Date(Date.now() - (HISTORY_DAYS + 1) * 86400_000).toISOString());
    await supabase.from('price_feed_runs').delete().lt('ran_at', new Date(Date.now() - 3 * 86400_000).toISOString());
  }

  const missing = assets.filter((a) => !quotes.has(a.symbol)).map((a) => a.symbol);
  const bySource = list.reduce<Record<string, number>>((m, q) => ((m[q.source] = (m[q.source] ?? 0) + 1), m), {});
  const { error: runErr } = await supabase.from('price_feed_runs').insert({
    duration_ms: Date.now() - started,
    markets_total: assets.length,
    markets_updated: latest.size,
    missing,
    by_source: bySource,
    provider_calls: { ...calls, yahoo_budget: YAHOO_CALLS_PER_MIN },
    rejected,
    errors,
    backfilled,
  });
  if (runErr) console.error('price_feed_runs insert failed', runErr.message);
  console.log(`💾 ${PASSES} passes, calls ${JSON.stringify(calls)}, yahoo ${yahooUsed()}/${YAHOO_CALLS_PER_MIN}${yahooThrottled ? ' (throttled)' : ''}, ${stored} updates for ${latest.size}/${assets.length} markets ${JSON.stringify(bySource)} in ${Date.now() - started}ms; missing: ${missing.join(',') || 'none'}; backfilled ${backfilled}; triggers ${JSON.stringify(triggers)}`);

  return Response.json({ success: true, stored, total: assets.length, bySource, missing, backfilled, triggers });
});
