/**
 * Account money rules. These must stay identical to the database
 * (validate_user_balance, account_withdrawable and settle_account).
 *
 * Balance = the client's own money. Credit = money given by the company:
 * it can be traded with, but it can never be withdrawn.
 */

export interface AccountInputs {
  balance: number;
  credit: number;
  usedMargin: number;
  /** Profit or loss of the positions that are still open */
  openPnL: number;
}

export interface AccountMetrics {
  equity: number;
  freeMargin: number;
  /** Percent; null when nothing is open */
  marginLevel: number | null;
  withdrawable: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Rounds down to cents, tolerant of floating point noise (940.45 stays 940.45). */
const floorCents = (v: number): number => Math.floor(v * 100 + 1e-6) / 100;

export const computeAccountMetrics = (a: AccountInputs): AccountMetrics => {
  const balance = num(a.balance);
  const credit = Math.max(num(a.credit), 0);
  const used = Math.max(num(a.usedMargin), 0);
  const openPnL = num(a.openPnL);

  // Credit counts for trading: it is part of equity, free margin and margin level
  const equity = balance + credit + openPnL;
  const freeMargin = Math.max(equity - used, 0);
  const marginLevel = used > 0 ? (equity / used) * 100 : null;

  // Only the client's own money can leave. Credit never counts, money held for open
  // trades and open losses are kept back, and open profit only counts once it is closed.
  const withdrawable = Math.max(floorCents(Math.min(balance, balance - used + Math.min(openPnL, 0))), 0);

  return { equity, freeMargin, marginLevel, withdrawable };
};

export interface BalanceSplit {
  /** Headline balance: own funds plus credit */
  total: number;
  /** The client's own money */
  own: number;
  /** Company money: trading only, never withdrawable */
  credit: number;
  /** Part of the total that is credit, 0 to 1 */
  creditShare: number;
}

/**
 * The balance a client sees is the total they can trade with (own funds + credit).
 * The split tells them how much of it is their own money and how much is credit.
 */
export const splitBalance = (a: { balance: number; credit: number }): BalanceSplit => {
  const own = num(a.balance);
  const credit = Math.max(num(a.credit), 0);
  const total = own + credit;
  const creditShare = credit <= 0 ? 0 : own <= 0 ? 1 : credit / total;
  return { total, own, credit, creditShare };
};

export interface SettleResult {
  balance: number;
  credit: number;
  /** Credit spent to cover the negative balance */
  creditUsed: number;
  /** Negative balance the company wrote off */
  cleared: number;
}

/**
 * What happens to an account with no open positions and a balance below zero:
 * credit pays the gap first; what is left follows the negative-balance setting.
 */
export const settleFlatAccount = (a: { balance: number; credit: number; allowNegativeBalance: boolean }): SettleResult => {
  const balance = num(a.balance);
  const credit = Math.max(num(a.credit), 0);
  if (balance >= 0) return { balance, credit, creditUsed: 0, cleared: 0 };
  const creditUsed = Math.min(credit, -balance);
  const afterCredit = balance + creditUsed;
  const cleared = afterCredit < 0 && !a.allowNegativeBalance ? -afterCredit : 0;
  return { balance: afterCredit + cleared, credit: credit - creditUsed, creditUsed, cleared };
};
