/**
 * Pure helpers that keep the screen's list of trades in step with the server.
 * The account store uses them; they are unit-tested in tradeSync.test.ts.
 */

interface SyncTrade {
  id: string;
  status: string;
}

/**
 * Compares the positions the screen believes are open with the ones the server reports open.
 * `vanished` were closed or removed on the server; `added` were opened there (pending order, bot, admin).
 */
export const diffOpenTrades = <T extends SyncTrade>(local: T[], serverOpen: T[]) => {
  const serverIds = new Set(serverOpen.map((t) => t.id));
  const localIds = new Set(local.map((t) => t.id));
  return {
    vanished: local.filter((t) => t.status === 'open' && !serverIds.has(t.id)),
    added: serverOpen.filter((t) => !localIds.has(t.id)),
  };
};

/** What happened between two full trade lists: positions that appeared and positions that got closed. */
export const diffTradeLists = <T extends SyncTrade>(prev: T[], next: T[]) => {
  const prevById = new Map(prev.map((t) => [t.id, t]));
  return {
    opened: next.filter((t) => t.status === 'open' && !prevById.has(t.id)),
    closed: next.filter((t) => t.status === 'closed' && prevById.get(t.id)?.status === 'open'),
  };
};

/**
 * Replaces open rows with the server's version (new stop-loss, margin…).
 * Returns the same array when nothing changed, so screens don't redraw for nothing.
 */
export const refreshOpenRows = <T extends SyncTrade>(local: T[], serverOpen: T[]): T[] => {
  const byId = new Map(serverOpen.map((t) => [t.id, t]));
  let changed = false;
  const next = local.map((t) => {
    const fresh = byId.get(t.id);
    if (!fresh || JSON.stringify(fresh) === JSON.stringify(t)) return t;
    changed = true;
    return fresh;
  });
  return changed ? next : local;
};
