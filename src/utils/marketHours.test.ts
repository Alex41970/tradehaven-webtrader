import { describe, it, expect } from "vitest";
import { isMarketOpen, nextMarketOpen } from "./marketHours";

// Thu 19 Nov 2026 12:00 UTC = 07:00 New York
const thuMorning = new Date("2026-11-19T12:00:00Z");
const satNoon = new Date("2026-11-21T17:00:00Z");

describe("market hours", () => {
  it("crypto is always open", () => {
    expect(isMarketOpen("BTCUSD", "crypto", satNoon)).toBe(true);
  });
  it("US stocks closed before 09:30 New York and open at 10:00", () => {
    expect(isMarketOpen("AAPL", "stocks", thuMorning)).toBe(false);
    expect(isMarketOpen("AAPL", "stocks", new Date("2026-11-19T15:00:00Z"))).toBe(true);
  });
  it("US stocks next open is 09:30 New York (14:30 UTC) the same day", () => {
    expect(nextMarketOpen("AAPL", "stocks", thuMorning)?.toISOString()).toBe("2026-11-19T14:30:00.000Z");
  });
  it("forex closed on Saturday, reopens Sunday 17:00 New York", () => {
    expect(isMarketOpen("EURUSD", "forex", satNoon)).toBe(false);
    expect(nextMarketOpen("EURUSD", "forex", satNoon)?.toISOString()).toBe("2026-11-22T22:00:00.000Z");
  });
  it("commodities closed during 17:00-18:00 New York daily break", () => {
    expect(isMarketOpen("XAUUSD", "commodities", new Date("2026-11-19T22:30:00Z"))).toBe(false);
    expect(isMarketOpen("XAUUSD", "commodities", new Date("2026-11-19T23:30:00Z"))).toBe(true);
  });
  it("GER40 open at 10:00 Frankfurt on a weekday", () => {
    expect(isMarketOpen("GER40", "indices", new Date("2026-11-19T09:00:00Z"))).toBe(true);
  });
});
