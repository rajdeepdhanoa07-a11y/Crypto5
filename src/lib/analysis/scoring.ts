// Transparent 0–100 research score. NOT a prediction of returns.
// Every point is traceable to an item with its input value. Where data is missing
// the item gets a fixed neutral 40% of its points and is labelled "N/A – neutral",
// so data-poor coins neither win nor lose purely because of missing data.
import type { Technicals } from './technicals';

export type Regime = 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'HIGH VOLATILITY';
export type RiskLevel = 'LOWER RELATIVE RISK' | 'MEDIUM RISK' | 'HIGH RISK' | 'VERY HIGH / SPECULATIVE';
export const RISK_ORDER: RiskLevel[] = ['LOWER RELATIVE RISK', 'MEDIUM RISK', 'HIGH RISK', 'VERY HIGH / SPECULATIVE'];

export type CatalystFact = { date: string | null; kind: string; event: string; unlockPct: number | null; resolved: boolean };

export type CoinFacts = {
  id: string; symbol: string; name: string; categories: string[];
  price: number | null; marketCap: number | null; fdv: number | null; volume24h: number | null;
  circulating: number | null; totalSupply: number | null; maxSupply: number | null;
  athChangePct: number | null; rank: number | null; ageYears: number | null;
  tech: Technicals | null;
  relBtc30d: number | null; relEth30d: number | null; relMarket30d: number | null;
  tvl: number | null; tvlChange7d: number | null; tvlChange30d: number | null; fees30d: number | null;
  commits4w: number | null; contributors: number | null; devTrend: number | null; hasRepo: boolean | null; lastPushDays: number | null; recentRelease: string | null;
  exchanges: number | null; hasDescription: boolean;
  catalysts: CatalystFact[];
  regime: Regime; marketAlt7d: number | null; today: string;
};

export type Item = { label: string; points: number; max: number; detail: string; na?: boolean };
export type Component = { key: string; label: string; points: number; max: number; items: Item[] };
export type Flag = { severity: 'SERIOUS' | 'WARNING'; code: string; text: string };
export type ScoreResult = { total: number; components: Component[]; flags: Flag[]; excluded: boolean; excludeReason: string | null; risk: RiskLevel; riskReasons: string[]; coverage: number };

const NEUTRAL = 0.4;
const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const usd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(2)}`);
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

function item(label: string, max: number, value: number | null | undefined, score: (v: number) => number, detail: (v: number) => string): Item {
  if (value === null || value === undefined || !Number.isFinite(value)) return { label, points: round1(max * NEUTRAL), max, detail: 'N/A – neutral (not measured)', na: true };
  return { label, points: round1(clamp(score(value), 0, max)), max, detail: detail(value) };
}
function comp(key: string, label: string, max: number, items: Item[]): Component {
  const pts = items.reduce((s, i) => s + i.points, 0);
  return { key, label, max, items, points: Math.round(clamp(pts, 0, max)) };
}
const logScale = (v: number, lo: number, hi: number, max: number) => (v <= lo ? 0 : v >= hi ? max : (Math.log10(v / lo) / Math.log10(hi / lo)) * max);

export function redFlags(f: CoinFacts, minVolume: number): Flag[] {
  const flags: Flag[] = [];
  const vm = f.volume24h && f.marketCap ? f.volume24h / f.marketCap : null;
  if (f.volume24h !== null && f.volume24h < minVolume) flags.push({ severity: 'SERIOUS', code: 'LOW_LIQUIDITY', text: `Extremely low liquidity: 24h volume ${usd(f.volume24h)} is below your ${usd(minVolume)} minimum.` });
  if (vm !== null && vm > 1.5) flags.push({ severity: 'SERIOUS', code: 'FAKE_VOLUME', text: `24h volume is ${vm.toFixed(1)}× market cap — unusually high, possible wash trading or fake volume.` });
  if (f.fdv && f.marketCap && f.fdv / f.marketCap > 5) flags.push({ severity: 'SERIOUS', code: 'SUPPLY_OVERHANG', text: `FDV is ${(f.fdv / f.marketCap).toFixed(1)}× market cap: most of the supply is not yet circulating.` });
  else if (f.circulating && (f.maxSupply ?? f.totalSupply) && f.circulating / (f.maxSupply ?? f.totalSupply)! < 0.3) flags.push({ severity: 'WARNING', code: 'LOW_FLOAT', text: `Only ${((f.circulating / (f.maxSupply ?? f.totalSupply)!) * 100).toFixed(0)}% of supply circulates; future emissions/unlocks may add sell pressure.` });
  if (f.tech && f.tech.perf7d !== null && f.tech.perf7d > 80 && (f.tech.rsi14 ?? 0) > 80) flags.push({ severity: 'SERIOUS', code: 'PUMP', text: `Parabolic move: ${pct(f.tech.perf7d)} in 7 days with RSI ${f.tech.rsi14!.toFixed(0)} — pump-and-dump risk.` });
  if (f.athChangePct !== null && f.athChangePct < -97 && (f.commits4w ?? 0) === 0) flags.push({ severity: 'SERIOUS', code: 'DEAD', text: `Down ${Math.abs(f.athChangePct).toFixed(0)}% from all-time high with no code commits in 4 weeks — project may be inactive.` });
  else if (f.hasRepo && f.commits4w === 0 && (f.lastPushDays ?? 0) > 180) flags.push({ severity: 'WARNING', code: 'ABANDONED_DEV', text: `No public code activity for ${f.lastPushDays} days.` });
  if (f.hasRepo === false) flags.push({ severity: 'WARNING', code: 'NO_REPO', text: 'No public code repository listed — development cannot be verified.' });
  if (f.exchanges !== null && f.exchanges < 3) flags.push({ severity: 'WARNING', code: 'FEW_MARKETS', text: `Trades on only ${f.exchanges} market${f.exchanges === 1 ? '' : 's'}.` });
  for (const c of f.catalysts) {
    if (c.kind === 'SECURITY' && !c.resolved) flags.push({ severity: 'SERIOUS', code: 'SECURITY', text: `Unresolved security incident: ${c.event}` });
    if (c.kind === 'UNLOCK' && c.date && c.date >= f.today && daysBetween(f.today, c.date) <= 30 && (c.unlockPct ?? 0) >= 5) flags.push({ severity: 'SERIOUS', code: 'BIG_UNLOCK', text: `Large token unlock of ${c.unlockPct}% of supply on ${c.date}.` });
  }
  if (!f.hasDescription && !f.categories.length) flags.push({ severity: 'WARNING', code: 'UNVERIFIABLE', text: 'Little verifiable project information available.' });
  return flags;
}

function daysBetween(a: string, b: string) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

export function riskLevel(f: CoinFacts, flags: Flag[]): { risk: RiskLevel; reasons: string[] } {
  let pts = 0;
  const reasons: string[] = [];
  const mc = f.marketCap ?? 0;
  if (mc < 50e6) { pts += 3; reasons.push(`Micro cap (${usd(mc)})`); } else if (mc < 300e6) { pts += 2; reasons.push(`Small cap (${usd(mc)})`); } else if (mc < 2e9) { pts += 1; reasons.push(`Mid cap (${usd(mc)})`); } else reasons.push(`Large cap (${usd(mc)})`);
  const vol = f.tech?.volatility30d;
  if (vol !== null && vol !== undefined) { if (vol > 150) { pts += 3; reasons.push(`Very high volatility (${vol.toFixed(0)}% annualised)`); } else if (vol > 90) { pts += 2; reasons.push(`High volatility (${vol.toFixed(0)}%)`); } else if (vol > 60) pts += 1; }
  const serious = flags.filter((x) => x.severity === 'SERIOUS').length, warn = flags.filter((x) => x.severity === 'WARNING').length;
  pts += serious * 3 + warn;
  if (serious) reasons.push(`${serious} serious red flag${serious > 1 ? 's' : ''}`);
  if (warn) reasons.push(`${warn} warning${warn > 1 ? 's' : ''}`);
  if ((f.ageYears ?? 0) < 1.5 && f.ageYears !== null) { pts += 1; reasons.push('Young project (<18 months)'); }
  const risk: RiskLevel = pts <= 1 ? 'LOWER RELATIVE RISK' : pts <= 3 ? 'MEDIUM RISK' : pts <= 5 ? 'HIGH RISK' : 'VERY HIGH / SPECULATIVE';
  return { risk, reasons };
}

export function scoreCoin(f: CoinFacts, minVolume: number): ScoreResult {
  const t = f.tech;
  const supplyCap = f.maxSupply ?? f.totalSupply;
  const circShare = f.circulating && supplyCap ? f.circulating / supplyCap : null;
  const fdvRatio = f.fdv && f.marketCap ? f.fdv / f.marketCap : null;
  const vm = f.volume24h && f.marketCap ? f.volume24h / f.marketCap : null;
  const upcoming = f.catalysts.filter((c) => c.date && c.date >= f.today && daysBetween(f.today, c.date) <= 60);
  const unlocksSoon = upcoming.filter((c) => c.kind === 'UNLOCK');
  const positiveSoon = upcoming.filter((c) => !['UNLOCK', 'SECURITY'].includes(c.kind));

  const fundamentals = comp('fundamentals', 'Fundamentals', 25, [
    item('Product usage (TVL)', 8, f.tvl, (v) => logScale(v, 1e6, 5e9, 8), (v) => `TVL ${usd(v)} (DeFiLlama)`),
    item('Usage growth (TVL 30d)', 4, f.tvlChange30d, (v) => 2 + v / 10, (v) => `TVL ${pct(v)} over 30 days`),
    item('Revenue / fees (30d)', 4, f.fees30d, (v) => logScale(v, 1e4, 5e7, 4), (v) => `Fees ${usd(v)} in 30 days`),
    item('Market maturity (age)', 4, f.ageYears, (v) => v * 0.8, (v) => `${v.toFixed(1)} years since genesis`),
    item('Market access (exchanges)', 5, f.exchanges, (v) => logScale(v, 2, 60, 5), (v) => `Listed on ${v} markets`),
  ]);
  const tokenomics = comp('tokenomics', 'Tokenomics', 15, [
    item('Circulating share of supply', 6, circShare, (v) => v * 6, (v) => `${(v * 100).toFixed(0)}% of max/total supply circulating`),
    item('FDV vs market cap', 5, fdvRatio, (v) => (v <= 1.2 ? 5 : v <= 2 ? 3.5 : v <= 4 ? 1.5 : 0), (v) => `FDV is ${v.toFixed(2)}× market cap`),
    unlocksSoon.length
      ? { label: 'Upcoming unlocks (60d)', max: 4, points: clamp(4 - unlocksSoon.reduce((s, c) => s + (c.unlockPct ?? 2), 0) / 2, 0, 4), detail: unlocksSoon.map((c) => `${c.date}: ${c.unlockPct ?? '?'}% unlock`).join('; ') }
      : { label: 'Upcoming unlocks (60d)', max: 4, points: round1(4 * NEUTRAL), detail: 'No unlock data entered – neutral (ESTIMATE). Add known unlocks under Catalysts.', na: true },
  ]);
  const technical = comp('technical', 'Technical Structure', 15, [
    item('Price vs 200-day EMA', 3, t?.price && t.ema200 ? t.price / t.ema200 - 1 : null, (v) => (v > 0 ? 3 : v > -0.1 ? 1.5 : 0), (v) => `${pct(v * 100)} vs 200 EMA`),
    item('Price vs 50-day EMA', 3, t?.price && t.ema50 ? t.price / t.ema50 - 1 : null, (v) => (v > 0 ? 3 : v > -0.05 ? 1.5 : 0), (v) => `${pct(v * 100)} vs 50 EMA`),
    item('20 EMA above 50 EMA', 2, t?.ema20 && t.ema50 ? t.ema20 / t.ema50 - 1 : null, (v) => (v > 0 ? 2 : 0), (v) => (v > 0 ? 'Short-term trend above medium-term' : 'Short-term trend below medium-term')),
    item('RSI(14) in healthy range', 3, t?.rsi14, (v) => (v >= 45 && v <= 70 ? 3 : v > 70 && v <= 80 ? 1.5 : v >= 35 && v < 45 ? 1.5 : 0.5), (v) => `RSI ${v.toFixed(0)}${v > 70 ? ' (overbought zone)' : v < 30 ? ' (oversold zone)' : ''}`),
    item('MACD histogram', 2, t?.macdHist, (v) => (v > 0 ? 2 : 0), (v) => (v > 0 ? 'MACD above signal' : 'MACD below signal')),
    item('30d strength vs BTC', 2, f.relBtc30d, (v) => (v > 5 ? 2 : v > -5 ? 1 : 0), (v) => `${pct(v)} vs BTC over 30 days`),
  ]);
  const liquidity = comp('liquidity', 'Liquidity', 10, [
    item('24h volume', 5, f.volume24h, (v) => logScale(v, 5e5, 5e8, 5), (v) => `${usd(v)} traded in 24h`),
    item('Volume / market cap', 3, vm, (v) => (v >= 0.02 && v <= 0.5 ? 3 : v > 0.5 && v <= 1.5 ? 1.5 : v < 0.02 ? 1 : 0), (v) => `Volume is ${(v * 100).toFixed(1)}% of market cap`),
    item('Volume trend (7d vs 30d)', 2, t?.volumeTrend, (v) => (v > 10 ? 2 : v > -20 ? 1 : 0), (v) => `${pct(v)} average volume`),
  ]);
  const onchain = comp('onchain', 'On-chain Growth', 10, [
    item('TVL 7-day change', 5, f.tvlChange7d, (v) => 2.5 + v / 4, (v) => `TVL ${pct(v)} in 7 days (DeFiLlama)`),
    item('TVL 30-day change', 5, f.tvlChange30d, (v) => 2.5 + v / 8, (v) => `TVL ${pct(v)} in 30 days`),
  ]);
  const development = comp('development', 'Developer Activity', 10, [
    item('Commits (last 4 weeks)', 5, f.hasRepo === false ? 0 : f.commits4w, (v) => logScale(v + 1, 1, 200, 5), (v) => `${v} commits in 4 weeks`),
    item('Contributors', 2, f.contributors, (v) => logScale(v + 1, 1, 30, 2), (v) => `${v} PR contributors`),
    item('Development trend', 3, f.devTrend, (v) => 1.5 + v / 20, (v) => `Commit activity ${pct(v)} vs previous 8 weeks`),
  ]);
  const catalysts = comp('catalysts', 'Catalysts', 5, [
    positiveSoon.length
      ? { label: 'Upcoming catalysts (60d)', max: 5, points: Math.min(5, 2 + positiveSoon.length * 1.5), detail: positiveSoon.map((c) => `${c.date}: ${c.event}`).join('; ') }
      : { label: 'Upcoming catalysts (60d)', max: 5, points: round1(5 * NEUTRAL), detail: 'No catalysts entered – neutral', na: true },
  ]);
  const market = comp('market', 'Market / Sector Strength', 5, [
    { label: 'Market regime', max: 2, points: f.regime === 'BULLISH' ? 2 : f.regime === 'NEUTRAL' ? 1 : 0, detail: `Regime: ${f.regime}` },
    item('7d vs altcoin market', 3, t?.perf7d !== null && t?.perf7d !== undefined && f.marketAlt7d !== null ? t.perf7d - f.marketAlt7d : null, (v) => (v > 5 ? 3 : v > -5 ? 1.5 : 0), (v) => `${pct(v)} vs average altcoin over 7 days`),
  ]);

  const flags = redFlags(f, minVolume);
  const { risk, reasons } = riskLevel(f, flags);
  let riskPts = 5;
  const riskItems: Item[] = [];
  const vol = t?.volatility30d ?? null;
  if (vol !== null && vol > 120) { riskPts -= 2; riskItems.push({ label: 'Volatility', points: -2, max: 0, detail: `${vol.toFixed(0)}% annualised` }); }
  if (f.athChangePct !== null && f.athChangePct < -90) { riskPts -= 1; riskItems.push({ label: 'Drawdown from ATH', points: -1, max: 0, detail: `${f.athChangePct.toFixed(0)}%` }); }
  if ((f.marketCap ?? 0) < 50e6) { riskPts -= 1; riskItems.push({ label: 'Micro cap', points: -1, max: 0, detail: usd(f.marketCap ?? 0) }); }
  for (const fl of flags) { riskPts -= fl.severity === 'SERIOUS' ? 2 : 1; riskItems.push({ label: fl.severity === 'SERIOUS' ? 'Serious red flag' : 'Warning', points: fl.severity === 'SERIOUS' ? -2 : -1, max: 0, detail: fl.text }); }
  const riskComp: Component = { key: 'risk', label: 'Risk Adjustment', max: 5, points: clamp(riskPts, 0, 5), items: [{ label: 'Starting points', points: 5, max: 5, detail: 'Deductions below' }, ...riskItems] };

  const components = [fundamentals, tokenomics, technical, liquidity, onchain, development, catalysts, market, riskComp];
  const total = components.reduce((s, c) => s + c.points, 0);
  const allItems = components.flatMap((c) => c.items).filter((i) => i.max > 0 && c_isScored(i));
  const coverage = allItems.length ? allItems.filter((i) => !i.na).length / allItems.length : 0;
  const serious = flags.find((x) => x.severity === 'SERIOUS');
  return { total: Math.round(total), components, flags, excluded: !!serious, excludeReason: serious ? serious.text : null, risk, riskReasons: reasons, coverage };
}
function c_isScored(i: Item) { return i.label !== 'Starting points'; }

/** Market-data-only pre-score used to choose which coins get the full (API-heavy) analysis. */
export function preScore(x: { marketCap: number | null; volume24h: number | null; fdv: number | null; change7d: number | null; change30d: number | null; circulating: number | null; maxSupply: number | null; totalSupply: number | null }): number {
  let s = 0;
  if (x.volume24h) s += logScale(x.volume24h, 5e5, 5e8, 10);
  const vm = x.volume24h && x.marketCap ? x.volume24h / x.marketCap : null;
  if (vm !== null) s += vm >= 0.02 && vm <= 0.5 ? 5 : vm > 1.5 ? -10 : 2;
  const fr = x.fdv && x.marketCap ? x.fdv / x.marketCap : null;
  if (fr !== null) s += fr <= 1.2 ? 6 : fr <= 2 ? 4 : fr <= 4 ? 1 : -4;
  if (x.change30d !== null) s += clamp(x.change30d / 5, -4, 6);
  if (x.change7d !== null) s += x.change7d > 60 ? -4 : clamp(x.change7d / 4, -3, 4);
  if (x.marketCap) s += logScale(x.marketCap, 2e7, 2e10, 6);
  return s;
}
