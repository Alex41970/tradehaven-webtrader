import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountStore, type Trade, type TradeEvent, type UserProfile } from './accountStore';

const USER = 'user-1';
const NOW = Date.parse('2026-11-24T18:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const trade = (id: string, status: 'open' | 'closed' = 'open', extra: Partial<Trade> = {}): Trade => ({
  id, user_id: USER, asset_id: 'btc', symbol: 'BTCUSD', trade_type: 'BUY', amount: 1, leverage: 100,
  open_price: 100, pnl: 0, margin_used: 50, status, trade_source: 'user',
  opened_at: iso(NOW - 60_000), created_at: iso(NOW - 60_000), updated_at: iso(NOW - 60_000), ...extra,
});

const profileOf = (balance: number, credit = 0): UserProfile => ({
  id: 'p1', user_id: USER, balance, credit, equity: balance + credit, used_margin: 0, available_margin: balance + credit,
  created_at: iso(NOW), updated_at: iso(NOW),
});

/** A pretend server: a database plus the live trading link */
const makeWorld = (opts: { linkUp?: boolean } = {}) => {
  const db = { profile: profileOf(10_000), trades: [trade('t1')] };
  const handlers = new Map<string, ((m: any) => void)[]>();
  const fire = (type: string, m: Record<string, unknown> = {}) => (handlers.get(type) ?? []).forEach((h) => h({ type, ...m }));
  const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  /** What the server does when a trade is closed: profit goes to the balance, the trade is closed */
  const serverClose = (id: string, pnl: number) => {
    db.trades = db.trades.map((t) => (t.id === id ? { ...t, status: 'closed' as const, pnl, closed_at: iso(NOW) } : t));
    db.profile = { ...db.profile, balance: db.profile.balance + pnl };
  };

  const api = {
    fetchProfile: vi.fn(async () => copy(db.profile)),
    fetchTrades: vi.fn(async () => copy(db.trades)),
    fetchOpenTrades: vi.fn(async () => copy(db.trades.filter((t) => t.status === 'open'))),
    insertTrade: vi.fn(async () => { db.trades = [trade('new', 'open', { opened_at: iso(NOW) }), ...db.trades]; }),
    closeTrade: vi.fn(async (id: string) => { serverClose(id, 25); }),
  };

  const socket = {
    on: (event: string, cb: (m: any) => void) => { handlers.set(event, [...(handlers.get(event) ?? []), cb]); },
    isConnected: () => !!opts.linkUp,
    connect: vi.fn(),
    openTrade: vi.fn(async () => true),
    // The real link sends the bare figures first and the full reply right after
    closeTrade: vi.fn(async (id: string) => {
      serverClose(id, 25);
      fire('margin_update', { data: { userId: USER, balance: db.profile.balance, credit: 0, usedMargin: 0, availableMargin: db.profile.balance, equity: db.profile.balance } });
      fire('trade_closed', { tradeId: id, pnl: 25, profile: copy(db.profile), trades: copy(db.trades) });
      return true;
    }),
  };

  const store = createAccountStore({ api, socket, now: () => NOW });
  const events: TradeEvent[] = [];
  store.onTradeEvent((e) => events.push(e));
  // Every state the screens ever get to draw: [own funds, number of positions counted as open]
  const seen: [number | undefined, number][] = [];
  store.subscribe(() => {
    const s = store.getState();
    seen.push([s.profile?.balance, s.trades.filter((t) => t.status === 'open').length]);
  });
  return { db, api, socket, store, events, seen, fire, serverClose };
};

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const openCount = (store: ReturnType<typeof makeWorld>['store']) => store.getState().trades.filter((t) => t.status === 'open').length;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('one account record for every screen', () => {
  it('a trade closed without the live link is no longer open anywhere, and the balance moves in the same step', async () => {
    const w = makeWorld({ linkUp: false });
    w.store.setUser(USER);
    await settle();
    expect(openCount(w.store)).toBe(1);

    await w.store.closeTrade('t1', 101);

    expect(w.api.closeTrade).toHaveBeenCalledWith('t1', 101);
    expect(openCount(w.store)).toBe(0);
    expect(w.store.getState().profile?.balance).toBe(10_025);
    // Never "new balance + trade still open" (that is what made equity count the profit twice)
    expect(w.seen).not.toContainEqual([10_025, 1]);
    // ...and never "trade gone + old balance" either
    expect(w.seen).not.toContainEqual([10_000, 0]);
    expect(w.events).toEqual([expect.objectContaining({ kind: 'closed', origin: 'self' })]);
  });

  it('a trade closed through the live link updates trades and balance together', async () => {
    const w = makeWorld({ linkUp: true });
    w.store.setUser(USER);
    await settle();

    await w.store.closeTrade('t1', 101);

    expect(w.api.closeTrade).not.toHaveBeenCalled();
    expect(openCount(w.store)).toBe(0);
    expect(w.store.getState().profile?.balance).toBe(10_025);
    expect(w.seen).not.toContainEqual([10_025, 1]);
    expect(w.seen).not.toContainEqual([10_000, 0]);
    expect(w.events).toHaveLength(1);
  });

  it('a position the server closed on its own (stop-loss, stop-out) stops counting at the next check', async () => {
    const w = makeWorld();
    w.store.setUser(USER);
    await settle();

    w.serverClose('t1', -40);
    w.store.checkNow();
    await settle();

    expect(openCount(w.store)).toBe(0);
    expect(w.store.getState().profile?.balance).toBe(9_960);
    expect(w.seen).not.toContainEqual([9_960, 1]);
    expect(w.events).toEqual([expect.objectContaining({ kind: 'closed', origin: 'server' })]);
  });

  it('the periodic check runs on its own every 15 seconds while a position is open', async () => {
    const w = makeWorld();
    w.store.setUser(USER);
    await settle();
    w.serverClose('t1', -40);

    await vi.advanceTimersByTimeAsync(15_000);
    await settle();

    expect(openCount(w.store)).toBe(0);
  });

  it('a position the server opened (pending order filled, bot) shows up at the next check', async () => {
    const w = makeWorld();
    w.store.setUser(USER);
    await settle();

    w.db.trades = [trade('filled', 'open', { opened_at: iso(NOW) }), ...w.db.trades];
    w.store.checkNow();
    await settle();

    expect(openCount(w.store)).toBe(2);
    expect(w.events).toEqual([expect.objectContaining({ kind: 'opened', origin: 'server' })]);
  });

  it('an older read that lands late cannot bring a closed trade back', async () => {
    const w = makeWorld({ linkUp: true });
    w.store.setUser(USER);
    await settle();

    // A read starts while the trade is still open and is slow to come back...
    let release!: (rows: Trade[]) => void;
    const staleRows = JSON.parse(JSON.stringify(w.db.trades)) as Trade[];
    w.api.fetchTrades.mockImplementationOnce(() => new Promise<Trade[]>((r) => { release = r; }));
    const slowRead = w.store.refresh();
    await settle();
    // ...meanwhile the trade is closed...
    await w.store.closeTrade('t1', 101);
    expect(openCount(w.store)).toBe(0);
    // ...and only now the old answer arrives, still saying "open"
    release(staleRows);
    await slowRead;
    await settle();

    expect(openCount(w.store)).toBe(0);
    expect(w.store.getState().profile?.balance).toBe(10_025);
    expect(w.seen).not.toContainEqual([10_025, 1]);
  });

  it('opening a trade without the live link adds it and reads the account back', async () => {
    const w = makeWorld({ linkUp: false });
    w.store.setUser(USER);
    await settle();

    await w.store.openTrade({ assetId: 'btc', symbol: 'BTCUSD', tradeType: 'BUY', amount: 1, leverage: 100, openPrice: 100, marginUsed: 1 });

    expect(openCount(w.store)).toBe(2);
    // The client did this themselves: the screen confirms it, not a "server opened a position" notice
    expect(w.events).toEqual([]);
  });

  it('signing out clears the account', async () => {
    const w = makeWorld();
    w.store.setUser(USER);
    await settle();
    w.store.setUser(null);
    expect(w.store.getState()).toMatchObject({ userId: null, profile: null, trades: [] });
  });
});
