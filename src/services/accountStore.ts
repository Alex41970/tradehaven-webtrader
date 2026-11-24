/**
 * The one copy of a signed-in client's account on this device: their profile
 * (own funds, credit, margin) and their trades. Every screen reads from here, so the
 * top bar, the trade screen and the positions list can never disagree.
 *
 * Data arrives three ways and always lands in the same place:
 *  - replies from the live trading link (instant, after the client's own actions)
 *  - a read from the database after every action
 *  - a light periodic check, which catches what the server did on its own
 *    (stop-loss, take-profit, stop-out, pending order filled, bot or admin action)
 */
import { diffOpenTrades, diffTradeLists, refreshOpenRows } from '@/utils/tradeSync';

export interface Trade {
  id: string;
  user_id: string;
  asset_id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  open_price: number;
  close_price?: number;
  current_price?: number;
  pnl: number;
  margin_used: number;
  status: 'open' | 'closed';
  trade_source: 'bot' | 'user';
  opened_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  stop_loss_price?: number;
  take_profit_price?: number;
}

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
  /** The client's own money */
  balance: number;
  /** Company money: usable for trading, never withdrawable */
  credit: number;
  equity: number;
  used_margin: number;
  available_margin: number;
  created_at: string;
  updated_at: string;
}

export type LinkState = 'connecting' | 'live' | 'offline';

export interface AccountState {
  userId: string | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  trades: Trade[];
  tradesLoading: boolean;
  /** Live trading link: instant replies when live, database path otherwise */
  link: LinkState;
}

export interface OpenTradeInput {
  assetId: string;
  symbol: string;
  tradeType: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  openPrice: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeEvent {
  kind: 'opened' | 'closed';
  trade: Trade;
  /** `self` = this client just did it here; `server` = it happened without them (stop-loss, bot, admin…) */
  origin: 'self' | 'server';
}

type SocketMessage = { type: string; [key: string]: any };

export interface AccountApi {
  fetchProfile(userId: string): Promise<UserProfile | null>;
  fetchTrades(userId: string): Promise<Trade[]>;
  fetchOpenTrades(userId: string): Promise<Trade[]>;
  insertTrade(userId: string, input: OpenTradeInput): Promise<void>;
  /** Closes at the server's price; throws with the server's reason when it refuses */
  closeTrade(tradeId: string, closePrice: number): Promise<void>;
}

export interface AccountSocket {
  on(event: string, cb: (m: SocketMessage) => void): void;
  isConnected(): boolean;
  connect(): void;
  openTrade(input: OpenTradeInput): Promise<boolean>;
  closeTrade(tradeId: string, closePrice: number): Promise<boolean>;
}

export interface AccountStoreDeps {
  api: AccountApi;
  socket: AccountSocket;
  /** True while nobody is looking (hidden tab, idle client): the periodic check waits */
  isPaused?: () => boolean;
  now?: () => number;
}

const CHECK_WITH_POSITIONS_MS = 15_000;
const CHECK_FLAT_MS = 30_000;
const PROFILE_WITH_POSITIONS_MS = 30_000;
const PROFILE_FLAT_MS = 60_000;
const LINK_GIVE_UP_MS = 20_000;
const ANNOUNCE_WINDOW_MS = 15 * 60_000;
const ANNOUNCE_MAX = 3;

const ALREADY_CLOSED = /not found or already closed/i;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const INITIAL: AccountState = {
  userId: null,
  profile: null,
  profileLoading: true,
  trades: [],
  tradesLoading: true,
  link: 'offline',
};

export const createAccountStore = ({ api, socket, isPaused = () => false, now = () => Date.now() }: AccountStoreDeps) => {
  let state: AccountState = INITIAL;
  let started = false;
  /** Goes up with every fresh write, so an older read that lands late can be recognised and dropped */
  let rev = 0;
  let lastProfileAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let linkTimer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let queued = false;
  let queuedAnnounce = false;
  let checking = false;
  /** Own actions in flight: their result is reported by the action itself, not as a server event */
  const closingHere = new Set<string>();
  let openingHere = 0;

  const listeners = new Set<() => void>();
  const eventListeners = new Set<(e: TradeEvent) => void>();

  const set = (patch: Partial<AccountState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const emit = (e: TradeEvent) => eventListeners.forEach((l) => l(e));
  const hasOpen = () => state.trades.some((t) => t.status === 'open');

  /** Tells listeners what the server did on its own between two trade lists */
  const announce = (prev: Trade[], next: Trade[]) => {
    const { opened, closed } = diffTradeLists(prev, next);
    // Only fresh news, and never a flood (e.g. a laptop waking up after a night of bot trading)
    const recent = (at?: string) => !!at && now() - new Date(at).getTime() < ANNOUNCE_WINDOW_MS;
    if (openingHere === 0) {
      opened.filter((t) => recent(t.opened_at)).slice(0, ANNOUNCE_MAX)
        .forEach((trade) => emit({ kind: 'opened', trade, origin: 'server' }));
    }
    closed.filter((t) => !closingHere.has(t.id) && recent(t.closed_at)).slice(0, ANNOUNCE_MAX)
      .forEach((trade) => emit({ kind: 'closed', trade, origin: 'server' }));
  };

  // ---- reading -------------------------------------------------------------------------

  const readEverything = async (tell: boolean) => {
    const uid = state.userId;
    if (!uid) return;
    const startRev = rev;
    let trades: Trade[];
    let profile: UserProfile | null;
    try {
      [trades, profile] = await Promise.all([api.fetchTrades(uid), api.fetchProfile(uid)]);
    } catch {
      if (state.userId === uid && (state.tradesLoading || state.profileLoading)) set({ tradesLoading: false, profileLoading: false });
      return;
    }
    if (state.userId !== uid) return;
    // Something newer arrived while this was loading: read again instead of overwriting it
    if (rev !== startRev && !state.tradesLoading) {
      queued = true;
      queuedAnnounce = queuedAnnounce || tell;
      return;
    }
    const prev = state.trades;
    const wasLoaded = !state.tradesLoading;
    rev++;
    lastProfileAt = now();
    // Profile and trades change in one step, so equity never shows a half-updated account
    set({ trades, profile: profile ?? state.profile, tradesLoading: false, profileLoading: false });
    if (tell && wasLoaded) announce(prev, trades);
  };

  /** Full read of the account from the database. Calls made while one is running are folded into one more pass. */
  const syncAccount = (opts: { announce?: boolean } = {}): Promise<void> => {
    if (running) {
      queued = true;
      queuedAnnounce = queuedAnnounce || !!opts.announce;
      return running;
    }
    running = (async () => {
      try {
        let tell = !!opts.announce;
        let passes = 0;
        do {
          queued = false;
          await readEverything(tell);
          tell = queuedAnnounce;
          queuedAnnounce = false;
        } while (queued && ++passes < 4);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  /** Light check: only the open positions (and the profile when it is due). */
  const check = async () => {
    const uid = state.userId;
    if (!uid || running || checking || state.tradesLoading) return;
    checking = true;
    const startRev = rev;
    const profileDue = now() - lastProfileAt >= (hasOpen() ? PROFILE_WITH_POSITIONS_MS : PROFILE_FLAT_MS) - 1_000;
    try {
      const [open, profile] = await Promise.all([
        api.fetchOpenTrades(uid),
        profileDue ? api.fetchProfile(uid) : Promise.resolve(undefined),
      ]);
      if (state.userId !== uid || rev !== startRev) return;
      const { vanished, added } = diffOpenTrades(state.trades, open);
      if (vanished.length || added.length) {
        // The server opened or closed something: take the full, final picture
        await syncAccount({ announce: true });
        return;
      }
      const patch: Partial<AccountState> = {};
      const trades = refreshOpenRows(state.trades, open);
      if (trades !== state.trades) patch.trades = trades;
      if (profile) {
        lastProfileAt = now();
        if (!same(profile, state.profile)) patch.profile = profile;
      }
      if (patch.trades || patch.profile) {
        rev++;
        set(patch);
      }
    } catch {
      // Network hiccup: the next check tries again
    } finally {
      checking = false;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!listeners.size || !state.userId) return;
    timer = setTimeout(async () => {
      if (!isPaused()) await check();
      schedule();
    }, hasOpen() ? CHECK_WITH_POSITIONS_MS : CHECK_FLAT_MS);
  };

  // ---- live trading link ---------------------------------------------------------------

  const setLink = (link: LinkState) => {
    if (linkTimer) clearTimeout(linkTimer);
    linkTimer = null;
    if (link === 'connecting') {
      linkTimer = setTimeout(() => {
        if (state.link === 'connecting') set({ link: 'offline' });
      }, LINK_GIVE_UP_MS);
    }
    if (state.link !== link) set({ link });
  };

  /** Applies the profile and trade list a live-link message carries, in one step */
  const applySnapshot = (m: SocketMessage) => {
    const prev = state.trades;
    const complete = Array.isArray(m.trades) && !!m.profile;
    rev++;
    if (m.profile) lastProfileAt = now();
    set({
      trades: Array.isArray(m.trades) ? (m.trades as Trade[]) : state.trades,
      profile: (m.profile as UserProfile | null) ?? state.profile,
      tradesLoading: complete ? false : state.tradesLoading,
      profileLoading: complete ? false : state.profileLoading,
    });
    // The server could not read part of it: get it from the database instead
    if (!complete) void syncAccount();
    return prev;
  };

  socket.on('auth_success', (m) => {
    if (!state.userId || m.user?.id !== state.userId) return;
    const wasLoaded = !state.tradesLoading;
    const prev = applySnapshot(m);
    setLink('live');
    // After a reconnect this is where the client learns what happened while the link was down
    if (wasLoaded) announce(prev, state.trades);
    schedule();
  });

  socket.on('trade_opened', (m) => {
    if (!state.userId) return;
    applySnapshot(m);
    schedule();
  });

  socket.on('trade_closed', (m) => {
    if (!state.userId) return;
    applySnapshot(m);
    const trade = state.trades.find((t) => t.id === m.tradeId);
    if (trade) emit({ kind: 'closed', trade, origin: 'self' });
    schedule();
  });

  socket.on('margin_update', (m) => {
    const d = m.data;
    // While an own action is in flight its reply brings profile and trades together;
    // applying the figures alone first would count a closing trade twice for a moment.
    if (!d || !state.profile || d.userId !== state.userId || closingHere.size || openingHere) return;
    const next: UserProfile = {
      ...state.profile,
      balance: d.balance ?? state.profile.balance,
      credit: d.credit ?? state.profile.credit,
      used_margin: d.usedMargin ?? state.profile.used_margin,
      available_margin: d.availableMargin ?? state.profile.available_margin,
      equity: d.equity ?? state.profile.equity,
    };
    if (same(next, state.profile)) return;
    rev++;
    set({ profile: next });
  });

  socket.on('auth_error', () => setLink('offline'));
  socket.on('connection_closed', () => {
    if (state.userId) setLink('offline');
  });

  // ---- public --------------------------------------------------------------------------

  const setUser = (userId: string | null) => {
    if (started && userId === state.userId) return;
    started = true;
    rev++;
    closingHere.clear();
    openingHere = 0;
    queued = false;
    queuedAnnounce = false;
    lastProfileAt = 0;
    if (linkTimer) clearTimeout(linkTimer);
    linkTimer = null;
    state = { ...INITIAL, userId, profileLoading: !!userId, tradesLoading: !!userId, link: 'offline' };
    listeners.forEach((l) => l());
    if (!userId) {
      schedule();
      return;
    }
    if (socket.isConnected()) setLink('live');
    else {
      setLink('connecting');
      socket.connect();
    }
    void syncAccount().then(schedule);
  };

  const openTrade = async (input: OpenTradeInput): Promise<boolean> => {
    const uid = state.userId;
    if (!uid) throw new Error('Not signed in');
    openingHere++;
    try {
      if (socket.isConnected()) {
        try {
          // The reply carries the new profile and trade list and is applied before this resolves
          await socket.openTrade(input);
          return true;
        } catch (e) {
          await syncAccount();
          throw e;
        }
      }
      await api.insertTrade(uid, input);
      await syncAccount();
      return true;
    } finally {
      openingHere--;
      schedule();
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number): Promise<boolean> => {
    if (!state.userId) throw new Error('Not signed in');
    closingHere.add(tradeId);
    /** `confirmed` = the server said it closed the trade */
    const finish = async (confirmed: boolean) => {
      await syncAccount();
      let trade = state.trades.find((t) => t.id === tradeId);
      if (confirmed && trade?.status === 'open') {
        // The read-back failed, but the trade is closed: never keep counting its profit.
        rev++;
        lastProfileAt = 0;
        set({ trades: state.trades.map((t) => (t.id === tradeId ? { ...t, status: 'closed' as const } : t)) });
        trade = state.trades.find((t) => t.id === tradeId);
      }
      if (trade?.status === 'closed') emit({ kind: 'closed', trade, origin: 'self' });
      return true;
    };
    try {
      if (socket.isConnected()) {
        try {
          await socket.closeTrade(tradeId, closePrice);
          return true;
        } catch (e) {
          // Stop-out or a second click got there first: just show the real state
          if (ALREADY_CLOSED.test(message(e))) {
            await syncAccount();
            return true;
          }
          // The reply can get lost when the link drops; look at the real state before deciding
          await syncAccount();
          if (state.trades.find((t) => t.id === tradeId)?.status !== 'open') return finish(false);
          if (!/timeout|not connected/i.test(message(e))) throw e;
          // Still open and the link is not answering: use the database path below
        }
      }
      try {
        await api.closeTrade(tradeId, closePrice);
      } catch (e) {
        if (!ALREADY_CLOSED.test(message(e))) {
          await syncAccount();
          throw e;
        }
        await syncAccount();
        return true;
      }
      return finish(true);
    } finally {
      closingHere.delete(tradeId);
      schedule();
    }
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) schedule();
    return () => {
      listeners.delete(listener);
      if (!listeners.size) schedule();
    };
  };

  return {
    getState: () => state,
    subscribe,
    setUser,
    /** Full read from the database (also what "refresh" buttons call) */
    refresh: () => syncAccount(),
    /** Light check now — used when the tab comes back or the client becomes active again */
    checkNow: () => {
      if (state.userId && listeners.size && !isPaused()) void check().then(schedule);
    },
    openTrade,
    closeTrade,
    onTradeEvent: (cb: (e: TradeEvent) => void) => {
      eventListeners.add(cb);
      return () => {
        eventListeners.delete(cb);
      };
    },
  };
};

export type AccountStore = ReturnType<typeof createAccountStore>;
