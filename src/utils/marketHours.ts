// Standard exchange trading hours. Mirrors SQL `is_market_open()` — keep both identical.
type Daily = { tz: string; open: number; close: number }; // minutes from local midnight, Mon-Fri

const INDEX_SESSIONS: Record<string, Daily> = {
  UK100: { tz: "Europe/London", open: 480, close: 990 },
  GER40: { tz: "Europe/Berlin", open: 540, close: 1050 },
  FRA40: { tz: "Europe/Paris", open: 540, close: 1050 },
  EU50: { tz: "Europe/Berlin", open: 540, close: 1050 },
  ITA40: { tz: "Europe/Rome", open: 540, close: 1050 },
  ESP35: { tz: "Europe/Madrid", open: 540, close: 1050 },
  NED25: { tz: "Europe/Amsterdam", open: 540, close: 1050 },
  SUI20: { tz: "Europe/Zurich", open: 540, close: 1050 },
  JPN225: { tz: "Asia/Tokyo", open: 540, close: 930 },
  HK50: { tz: "Asia/Hong_Kong", open: 570, close: 960 },
  CHINA50: { tz: "Asia/Shanghai", open: 570, close: 900 },
  AUS200: { tz: "Australia/Sydney", open: 600, close: 960 },
  IND50: { tz: "Asia/Kolkata", open: 555, close: 930 },
  KOR200: { tz: "Asia/Seoul", open: 540, close: 930 },
  CAN60: { tz: "America/Toronto", open: 570, close: 960 },
  BRA50: { tz: "America/Sao_Paulo", open: 600, close: 1020 },
};
const US: Daily = { tz: "America/New_York", open: 570, close: 960 };
const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function local(tz: string, d: Date) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { dow: DAYS[p.weekday], min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

export function isMarketOpen(symbol: string, category: string | undefined, now: Date = new Date()): boolean {
  if (!category || category === "crypto") return true;
  if (category === "forex" || category === "commodities") {
    const { dow, min } = local("America/New_York", now);
    const open = category === "forex" ? 17 * 60 : 18 * 60;
    if (dow === 6) return false;
    if (dow === 0) return min >= open;
    if (dow === 5) return min < 17 * 60;
    if (category === "commodities" && min >= 17 * 60 && min < 18 * 60) return false;
    return true;
  }
  const s = INDEX_SESSIONS[symbol] ?? US;
  const { dow, min } = local(s.tz, now);
  return dow >= 1 && dow <= 5 && min >= s.open && min < s.close;
}

/** Next time (>= now) the market opens; null if open now or always open. 15-min steps (all opens fall on them). */
export function nextMarketOpen(symbol: string, category: string | undefined, now: Date = new Date()): Date | null {
  if (isMarketOpen(symbol, category, now)) return null;
  const step = 15 * 60 * 1000;
  let t = Math.ceil(now.getTime() / step) * step;
  for (let i = 0; i < 4 * 24 * 9; i++, t += step) {
    if (isMarketOpen(symbol, category, new Date(t))) return new Date(t);
  }
  return null;
}

export function formatOpensAt(open: Date, now: Date = new Date()): string {
  const ms = open.getTime() - now.getTime();
  if (ms < 24 * 3600 * 1000) {
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `opens in ${h > 0 ? `${h}h ` : ""}${m}m`;
  }
  return `opens ${open.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
}
