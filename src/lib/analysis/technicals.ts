// Technical indicators on daily closes. Pure functions (unit-tested).

export function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    if (prev === null) { prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; out.push(prev); continue; }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast), s = ema(values, slow);
  const line = values.map((_, i) => (f[i] !== null && s[i] !== null ? f[i]! - s[i]! : null));
  const valid = line.filter((x): x is number => x !== null);
  const sigValid = ema(valid, signal);
  const offset = line.length - valid.length;
  const sig = line.map((_, i) => (i < offset ? null : sigValid[i - offset]));
  const hist = line.map((l, i) => (l !== null && sig[i] !== null ? l - sig[i]! : null));
  return { line, signal: sig, hist };
}

export function pctChange(values: number[], days: number): number | null {
  if (values.length <= days) return null;
  const a = values[values.length - 1 - days], b = values[values.length - 1];
  return a > 0 ? ((b - a) / a) * 100 : null;
}

/** Annualised volatility of daily log returns over the last `window` days, in %. */
export function volatility(values: number[], window = 30): number | null {
  if (values.length < window + 1) return null;
  const s = values.slice(-window - 1);
  const r = s.slice(1).map((v, i) => Math.log(v / s[i]));
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(365) * 100;
}

/** Nearest support below and resistance above the last price from 90-day swing lows/highs. */
export function supportResistance(values: number[], lookback = 90): { support: number | null; resistance: number | null } {
  const s = values.slice(-lookback);
  if (s.length < 10) return { support: null, resistance: null };
  const last = s[s.length - 1];
  const lows: number[] = [], highs: number[] = [];
  for (let i = 3; i < s.length - 3; i++) {
    const win = s.slice(i - 3, i + 4);
    if (s[i] === Math.min(...win)) lows.push(s[i]);
    if (s[i] === Math.max(...win)) highs.push(s[i]);
  }
  const support = lows.filter((x) => x < last).sort((a, b) => b - a)[0] ?? Math.min(...s);
  const resistance = highs.filter((x) => x > last).sort((a, b) => a - b)[0] ?? null;
  return { support, resistance };
}

export type Technicals = {
  price: number | null;
  rsi14: number | null;
  macd: number | null; macdSignal: number | null; macdHist: number | null;
  ema20: number | null; ema50: number | null; ema200: number | null;
  volumeTrend: number | null; // % change of 7d avg volume vs prior 30d avg
  volatility30d: number | null;
  support: number | null; resistance: number | null;
  perf7d: number | null; perf30d: number | null; perf90d: number | null; perf180d: number | null;
  momentum: 'UP' | 'DOWN' | 'SIDEWAYS' | null;
  days: number;
};

export function computeTechnicals(prices: number[], volumes: number[]): Technicals {
  const last = <T,>(a: (T | null)[]) => (a.length ? a[a.length - 1] : null);
  const m = macd(prices);
  const e20 = last(ema(prices, 20)), e50 = last(ema(prices, 50)), e200 = last(ema(prices, 200));
  const price = prices.length ? prices[prices.length - 1] : null;
  let volumeTrend: number | null = null;
  if (volumes.length >= 37) {
    const v7 = volumes.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const v30 = volumes.slice(-37, -7).reduce((a, b) => a + b, 0) / 30;
    volumeTrend = v30 > 0 ? ((v7 - v30) / v30) * 100 : null;
  }
  const sr = supportResistance(prices);
  let momentum: Technicals['momentum'] = null;
  if (price !== null && e20 !== null && e50 !== null) momentum = price > e20 && e20 > e50 ? 'UP' : price < e20 && e20 < e50 ? 'DOWN' : 'SIDEWAYS';
  return {
    price, rsi14: last(rsi(prices)), macd: last(m.line), macdSignal: last(m.signal), macdHist: last(m.hist),
    ema20: e20, ema50: e50, ema200: e200, volumeTrend, volatility30d: volatility(prices),
    support: sr.support, resistance: sr.resistance,
    perf7d: pctChange(prices, 7), perf30d: pctChange(prices, 30), perf90d: pctChange(prices, 90), perf180d: pctChange(prices, 180),
    momentum, days: prices.length,
  };
}
