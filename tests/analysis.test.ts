import { describe, it, expect } from 'vitest';
import { ema, rsi, macd, pctChange, volatility, computeTechnicals } from '@/lib/analysis/technicals';
import { scoreCoin, redFlags, riskLevel, preScore, type CoinFacts } from '@/lib/analysis/scoring';
import { classifyRegime } from '@/lib/analysis/regime';

const range = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

describe('technicals', () => {
  it('ema of a constant series is the constant, null before warm-up', () => {
    const e = ema(range(30, () => 5), 10);
    expect(e[0]).toBeNull();
    expect(e[29]).toBeCloseTo(5);
  });
  it('rsi is 100 for a rising series and 0 for a falling one', () => {
    expect(rsi(range(40, (i) => 100 + i)).at(-1)).toBeCloseTo(100);
    expect(rsi(range(40, (i) => 100 - i)).at(-1)).toBeCloseTo(0);
  });
  it('macd is positive in an uptrend', () => {
    const m = macd(range(120, (i) => 100 * 1.01 ** i));
    expect(m.line.at(-1)!).toBeGreaterThan(0);
  });
  it('pctChange and volatility', () => {
    expect(pctChange([100, 110, 121], 2)).toBeCloseTo(21);
    expect(pctChange([100], 5)).toBeNull();
    expect(volatility(range(40, () => 1))).toBeCloseTo(0);
  });
  it('computeTechnicals returns nulls, not invented numbers, when history is short', () => {
    const t = computeTechnicals([1, 2, 3], [1, 1, 1]);
    expect(t.ema200).toBeNull();
    expect(t.perf90d).toBeNull();
  });
  it('computeTechnicals flags an uptrend', () => {
    const t = computeTechnicals(range(365, (i) => 1 + i * 0.01), range(365, () => 1e6));
    expect(t.momentum).toBe('UP');
    expect(t.ema200).not.toBeNull();
  });
});

const base = (o: Partial<CoinFacts> = {}): CoinFacts => ({
  id: 'x', symbol: 'x', name: 'X', categories: ['Layer 1 (L1)'],
  price: 0.5, marketCap: 200e6, fdv: 300e6, volume24h: 20e6, circulating: 400e6, totalSupply: 600e6, maxSupply: 600e6,
  athChangePct: -70, rank: 150, ageYears: 3, tech: null, relBtc30d: null, relEth30d: null, relMarket30d: null,
  tvl: null, tvlChange7d: null, tvlChange30d: null, fees30d: null,
  commits4w: null, contributors: null, devTrend: null, hasRepo: null, lastPushDays: null, recentRelease: null,
  exchanges: 20, hasDescription: true, catalysts: [], regime: 'NEUTRAL', marketAlt7d: null, today: '2026-09-27', ...o,
});

describe('scoring', () => {
  it('score is 0–100, components sum to total and weights sum to 100', () => {
    const s = scoreCoin(base(), 1e6);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.components.reduce((a, c) => a + c.max, 0)).toBe(100);
    expect(s.components.reduce((a, c) => a + c.points, 0)).toBe(s.total);
  });
  it('missing data is labelled N/A – neutral, not invented', () => {
    const s = scoreCoin(base(), 1e6);
    const dev = s.components.find((c) => c.key === 'development')!;
    expect(dev.items.every((i) => i.na)).toBe(true);
    expect(dev.items[0].detail).toMatch(/N\/A/);
    expect(s.coverage).toBeLessThan(1);
  });
  it('wash-trading level volume is a serious red flag that excludes the coin', () => {
    const f = base({ volume24h: 400e6 }); // 200% of market cap
    const flags = redFlags(f, 1e6);
    expect(flags.some((x) => x.severity === 'SERIOUS')).toBe(true);
    expect(scoreCoin(f, 1e6).excluded).toBe(true);
  });
  it('tiny market cap is riskier than a large one', () => {
    const small = riskLevel(base({ marketCap: 5e6, volume24h: 2e6 }), []);
    const large = riskLevel(base({ marketCap: 20e9, volume24h: 1e9, rank: 10, ageYears: 8 }), []);
    const order = ['LOWER RELATIVE RISK', 'MEDIUM RISK', 'HIGH RISK', 'VERY HIGH / SPECULATIVE'];
    expect(order.indexOf(small.risk)).toBeGreaterThan(order.indexOf(large.risk));
  });
  it('preScore handles missing values', () => {
    const v = preScore({ marketCap: null, volume24h: null, fdv: null, change7d: null, change30d: null, circulating: null, maxSupply: null, totalSupply: null });
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe('regime', () => {
  it('bullish when broad signals are positive', () => {
    const r = classifyRegime({ btc7d: 8, eth7d: 10, alt7d: 12, breadth7d: 80, fearGreed: 70, btcVol30d: 40, btcAboveEma50: true, totalMcapChange24h: 2 });
    expect(r.regime).toBe('BULLISH');
    expect(r.evidence.length).toBeGreaterThan(3);
  });
  it('bearish when broad signals are negative', () => {
    const r = classifyRegime({ btc7d: -9, eth7d: -12, alt7d: -15, breadth7d: 15, fearGreed: 20, btcVol30d: 45, btcAboveEma50: false, totalMcapChange24h: -3 });
    expect(r.regime).toBe('BEARISH');
  });
  it('missing inputs lower confidence rather than invent a view', () => {
    const r = classifyRegime({ btc7d: null, eth7d: null, alt7d: null, breadth7d: null, fearGreed: null, btcVol30d: null, btcAboveEma50: null, totalMcapChange24h: null });
    expect(r.confidence).toBe('LOW');
    expect(r.regime).toBe('NEUTRAL');
  });
});
