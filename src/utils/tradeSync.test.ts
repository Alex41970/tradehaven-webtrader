import { describe, expect, it } from 'vitest';
import { diffOpenTrades, diffTradeLists, refreshOpenRows } from './tradeSync';

const t = (id: string, status: 'open' | 'closed', extra: Record<string, unknown> = {}) => ({ id, status, ...extra });

describe('comparing the screen with the server', () => {
  it('spots a position the server closed', () => {
    const { vanished, added } = diffOpenTrades([t('a', 'open'), t('b', 'open'), t('c', 'closed')], [t('b', 'open')]);
    expect(vanished.map((x) => x.id)).toEqual(['a']);
    expect(added).toEqual([]);
  });

  it('spots a position the server opened (pending order, bot, admin)', () => {
    const { vanished, added } = diffOpenTrades([t('a', 'open')], [t('a', 'open'), t('n', 'open')]);
    expect(vanished).toEqual([]);
    expect(added.map((x) => x.id)).toEqual(['n']);
  });

  it('reports nothing when both agree', () => {
    expect(diffOpenTrades([t('a', 'open'), t('c', 'closed')], [t('a', 'open')])).toEqual({ vanished: [], added: [] });
  });

  it('tells which positions were opened and which were closed between two lists', () => {
    const { opened, closed } = diffTradeLists(
      [t('a', 'open'), t('b', 'open'), t('old', 'closed')],
      [t('a', 'closed'), t('b', 'open'), t('old', 'closed'), t('n', 'open')],
    );
    expect(opened.map((x) => x.id)).toEqual(['n']);
    expect(closed.map((x) => x.id)).toEqual(['a']);
  });

  it('takes changed open rows and keeps the same list when nothing changed', () => {
    const local = [t('a', 'open', { stop_loss_price: 10 }), t('c', 'closed')];
    expect(refreshOpenRows(local, [t('a', 'open', { stop_loss_price: 10 })])).toBe(local);
    const next = refreshOpenRows(local, [t('a', 'open', { stop_loss_price: 12 })]);
    expect(next).not.toBe(local);
    expect(next[0]).toEqual(t('a', 'open', { stop_loss_price: 12 }));
    expect(next[1]).toBe(local[1]);
  });
});
