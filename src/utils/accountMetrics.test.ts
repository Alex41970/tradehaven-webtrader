import { describe, expect, it } from 'vitest';
import { computeAccountMetrics, settleFlatAccount, splitBalance } from './accountMetrics';

describe('credit can be traded with', () => {
  it('counts credit in equity and free margin', () => {
    const m = computeAccountMetrics({ balance: 0, credit: 5000, usedMargin: 0, openPnL: 0 });
    expect(m.equity).toBe(5000);
    expect(m.freeMargin).toBe(5000);
  });

  it('counts credit in the margin level', () => {
    const withCredit = computeAccountMetrics({ balance: 400, credit: 5000, usedMargin: 3000, openPnL: 0 });
    const without = computeAccountMetrics({ balance: 400, credit: 0, usedMargin: 3000, openPnL: 0 });
    expect(withCredit.marginLevel).toBe(180);
    expect(without.marginLevel).toBeCloseTo(13.33, 2);
  });
});

describe('credit cannot be withdrawn', () => {
  it('leaves nothing to withdraw on a credit-only account', () => {
    expect(computeAccountMetrics({ balance: 0, credit: 5000, usedMargin: 0, openPnL: 0 }).withdrawable).toBe(0);
  });

  it('only the balance not held for open trades can be withdrawn', () => {
    expect(computeAccountMetrics({ balance: 1000, credit: 5000, usedMargin: 59.55, openPnL: 0 }).withdrawable).toBe(940.45);
  });

  it('a buy and a sell opened together cannot turn credit into cash', () => {
    // winner closed (+102.64 on the balance), loser still open (-102.64)
    expect(computeAccountMetrics({ balance: 102.64, credit: 5000, usedMargin: 286.59, openPnL: -102.64 }).withdrawable).toBe(0);
  });

  it('open profit is not withdrawable until it is closed', () => {
    expect(computeAccountMetrics({ balance: 1000, credit: 0, usedMargin: 0, openPnL: 500 }).withdrawable).toBe(1000);
  });

  it('never goes below zero', () => {
    expect(computeAccountMetrics({ balance: -250, credit: 5000, usedMargin: 0, openPnL: 0 }).withdrawable).toBe(0);
  });
});

describe('credit covers losses once all positions are closed', () => {
  it('pays a negative balance from credit', () => {
    expect(settleFlatAccount({ balance: -1000, credit: 5000, allowNegativeBalance: false }))
      .toEqual({ balance: 0, credit: 4000, creditUsed: 1000, cleared: 0 });
  });

  it('clears what credit cannot cover when negative balances are not allowed', () => {
    expect(settleFlatAccount({ balance: -7000, credit: 5000, allowNegativeBalance: false }))
      .toEqual({ balance: 0, credit: 0, creditUsed: 5000, cleared: 2000 });
  });

  it('keeps the debt when negative balances are allowed', () => {
    expect(settleFlatAccount({ balance: -7000, credit: 5000, allowNegativeBalance: true }))
      .toEqual({ balance: -2000, credit: 0, creditUsed: 5000, cleared: 0 });
  });

  it('does not touch credit while the balance is positive', () => {
    expect(settleFlatAccount({ balance: 300, credit: 5000, allowNegativeBalance: false }))
      .toEqual({ balance: 300, credit: 5000, creditUsed: 0, cleared: 0 });
  });
});

describe('the balance a client sees: total, with own funds and credit told apart', () => {
  it('$80,000 own funds + $20,000 credit shows as $100,000, of which $20,000 is credit', () => {
    expect(splitBalance({ balance: 80_000, credit: 20_000 })).toEqual({ total: 100_000, own: 80_000, credit: 20_000, creditShare: 0.2 });
  });

  it('an account without credit is all own funds', () => {
    expect(splitBalance({ balance: 691_210.24, credit: 0 })).toEqual({ total: 691_210.24, own: 691_210.24, credit: 0, creditShare: 0 });
  });

  it('a credit-only account is all credit', () => {
    expect(splitBalance({ balance: 0, credit: 5_000 })).toEqual({ total: 5_000, own: 0, credit: 5_000, creditShare: 1 });
  });
});

describe('equity with no open positions', () => {
  it('is own funds + credit and does not depend on prices', () => {
    const flat = computeAccountMetrics({ balance: 10_054.9, credit: 2_000, usedMargin: 0, openPnL: 0 });
    expect(flat.equity).toBe(12_054.9);
    expect(flat.marginLevel).toBeNull();
  });
});
