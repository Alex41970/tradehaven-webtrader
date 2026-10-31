// Technical indicators computed from close prices. Output arrays align with input; null = not enough data yet.
type V = (number | null)[];

export function sma(src: number[], n: number): V {
  const out: V = [];
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= n) sum -= src[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

export function ema(src: number[], n: number): V {
  const out: V = [];
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (let i = 0; i < src.length; i++) {
    if (i < n - 1) { out.push(null); continue; }
    if (prev == null) prev = src.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
    else prev = src[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function bollinger(src: number[], n = 20, mult = 2) {
  const mid = sma(src, n);
  const upper: V = [], lower: V = [];
  for (let i = 0; i < src.length; i++) {
    const m = mid[i];
    if (m == null) { upper.push(null); lower.push(null); continue; }
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (src[j] - m) ** 2;
    const sd = Math.sqrt(v / n);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { upper, mid, lower };
}

export function rsi(src: number[], n = 14): V {
  const out: V = [null];
  let g = 0, l = 0;
  for (let i = 1; i < src.length; i++) {
    const d = src[i] - src[i - 1];
    const up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) {
      g += up; l += dn;
      if (i === n) { g /= n; l /= n; out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); } else out.push(null);
    } else {
      g = (g * (n - 1) + up) / n;
      l = (l * (n - 1) + dn) / n;
      out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
  }
  return out.slice(0, src.length);
}

export function macd(src: number[], fast = 12, slow = 26, sig = 9) {
  const f = ema(src, fast), s = ema(src, slow);
  const line: V = src.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null));
  const start = line.findIndex((v) => v != null);
  const signal: V = Array(src.length).fill(null);
  if (start >= 0) {
    const e = ema(line.slice(start) as number[], sig);
    e.forEach((v, i) => (signal[start + i] = v));
  }
  const hist: V = line.map((v, i) => (v != null && signal[i] != null ? v - (signal[i] as number) : null));
  return { macd: line, signal, hist };
}

// Cumulative average of typical price (no volume in our feed)
export function vwapLike(c: { high: number; low: number; close: number }[]): V {
  let sum = 0;
  return c.map((x, i) => { sum += (x.high + x.low + x.close) / 3; return sum / (i + 1); });
}
