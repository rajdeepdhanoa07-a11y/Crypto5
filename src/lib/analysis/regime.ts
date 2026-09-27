import type { Regime } from './scoring';

export type RegimeInput = {
  btc7d: number | null; eth7d: number | null; alt7d: number | null; breadth7d: number | null; // % of top-100 alts up over 7d
  fearGreed: number | null; btcVol30d: number | null; btcAboveEma50: boolean | null; totalMcapChange24h: number | null;
};
export type Evidence = { signal: string; value: string; reads: 'bullish' | 'bearish' | 'neutral' | 'volatile' };

/** Rule-based regime classification with the evidence behind it. A description of current conditions, not a forecast. */
export function classifyRegime(x: RegimeInput): { regime: Regime; score: number; evidence: Evidence[]; confidence: 'LOW' | 'MEDIUM' } {
  const ev: Evidence[] = [];
  let score = 0;
  const f = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const vote = (name: string, v: number | null, up: number, down: number, fmt: (n: number) => string) => {
    if (v === null) { ev.push({ signal: name, value: 'N/A', reads: 'neutral' }); return; }
    const reads = v > up ? 'bullish' : v < down ? 'bearish' : 'neutral';
    score += reads === 'bullish' ? 1 : reads === 'bearish' ? -1 : 0;
    ev.push({ signal: name, value: fmt(v), reads });
  };
  vote('BTC 7-day change', x.btc7d, 3, -3, f);
  vote('ETH 7-day change', x.eth7d, 3, -3, f);
  vote('Average altcoin 7-day change (top 100)', x.alt7d, 3, -3, f);
  vote('Breadth: altcoins up over 7 days', x.breadth7d, 60, 40, (n) => `${n.toFixed(0)}%`);
  vote('Fear & Greed index', x.fearGreed, 55, 45, (n) => `${n.toFixed(0)}/100`);
  if (x.btcAboveEma50 === null) ev.push({ signal: 'BTC vs 50-day EMA', value: 'N/A', reads: 'neutral' });
  else { score += x.btcAboveEma50 ? 1 : -1; ev.push({ signal: 'BTC vs 50-day EMA', value: x.btcAboveEma50 ? 'Above' : 'Below', reads: x.btcAboveEma50 ? 'bullish' : 'bearish' }); }
  const volatile = (x.btcVol30d !== null && x.btcVol30d > 70) || (x.btc7d !== null && Math.abs(x.btc7d) > 12);
  ev.push({ signal: 'BTC 30-day volatility (annualised)', value: x.btcVol30d === null ? 'N/A' : `${x.btcVol30d.toFixed(0)}%`, reads: volatile ? 'volatile' : 'neutral' });
  const regime: Regime = volatile ? 'HIGH VOLATILITY' : score >= 3 ? 'BULLISH' : score <= -3 ? 'BEARISH' : 'NEUTRAL';
  const known = ev.filter((e) => e.value !== 'N/A').length;
  return { regime, score, evidence: ev, confidence: known >= 6 && Math.abs(score) >= 4 ? 'MEDIUM' : 'LOW' };
}
