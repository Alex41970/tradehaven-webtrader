import { describe, it, expect } from "vitest";
import { alertCrossed, journalStats, estimateBullish, blendSentiment } from "./marketIntel";

describe("price alerts", () => {
  it("fires 'above' when price crosses up through target", () => {
    expect(alertCrossed("above", 2800, 2799, 2801)).toBe(true);
  });
  it("does not fire 'above' when price was already above", () => {
    expect(alertCrossed("above", 2800, 2810, 2820)).toBe(false);
  });
  it("fires 'below' when price crosses down through target", () => {
    expect(alertCrossed("below", 100, 101, 99.5)).toBe(true);
  });
  it("fires immediately on first price if already past target", () => {
    expect(alertCrossed("below", 100, undefined, 90)).toBe(true);
  });
});

describe("journal", () => {
  const t = (pnl: number, hours: number) => ({ symbol: "X", pnl, opened_at: "2026-01-01T00:00:00Z", closed_at: new Date(Date.parse("2026-01-01T00:00:00Z") + hours * 3600e3).toISOString() });
  it("computes profit factor, win rate and average hold", () => {
    const s = journalStats([t(300, 1), t(100, 3), t(-200, 2)]);
    expect(s.profitFactor).toBe(2);
    expect(s.winRate).toBeCloseTo(66.67, 1);
    expect(s.avgHoldMs).toBe(2 * 3600e3);
    expect(s.winLossRatio).toBe(1);
  });
  it("profit factor is null with no losses", () => {
    expect(journalStats([t(50, 1)]).profitFactor).toBeNull();
  });
});

describe("sentiment", () => {
  it("is neutral 50% with no price change", () => {
    expect(estimateBullish(0, "crypto")).toBe(50);
  });
  it("labels as traders only when real positions exist", () => {
    expect(blendSentiment(60, null).source).toBe("market");
    expect(blendSentiment(50, { buy: 8, sell: 2 })).toEqual({ bullish: 71, source: "traders" });
  });
});
