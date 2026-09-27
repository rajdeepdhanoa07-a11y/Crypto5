// Turns measured facts into plain-English research notes. Every sentence is built from a
// number we actually have; nothing here predicts prices or tells anyone to buy or sell.
import type { CoinFacts, ScoreResult } from './scoring';

const usd = (n: number) => (n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toPrecision(3)}`);
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
export const priceFmt = (n: number) => (n >= 100 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(4)}` : `$${n.toPrecision(3)}`);

export type Narrative = {
  whyQualified: string[]; bullCase: string[]; bearCase: string[]; whyNot: string[]; invalidation: string[];
  lowPriceNote: string | null; keyCatalyst: string | null; mainRisk: string; social: 'Organic Growth' | 'Hype Driven' | 'Mixed' | 'Insufficient Data'; socialWhy: string;
  technicalSetup: string; fundamentalThesis: string;
};

export function socialClass(f: CoinFacts): { cls: Narrative['social']; why: string } {
  const t = f.tech;
  const hasGrowth = (f.tvlChange30d ?? null) !== null || (f.devTrend ?? null) !== null;
  if (!t || (!hasGrowth && t.volumeTrend === null)) return { cls: 'Insufficient Data', why: 'Not enough usage, development or volume data to judge where attention is coming from.' };
  const priceHot = (t.perf7d ?? 0) > 40 || (t.volumeTrend ?? 0) > 150;
  const usageUp = (f.tvlChange30d ?? 0) > 5 || (f.devTrend ?? 0) > 10;
  const usageDown = (f.tvlChange30d ?? 0) < -5 && (f.devTrend ?? 0) < 0;
  if (priceHot && !usageUp) return { cls: 'Hype Driven', why: `Price/volume spiked (${pct(t.perf7d ?? 0)} in 7d, volume ${pct(t.volumeTrend ?? 0)}) without matching growth in usage or development.` };
  if (usageUp && !priceHot) return { cls: 'Organic Growth', why: 'Usage or development activity is rising without an extreme price or volume spike.' };
  if (usageDown && priceHot) return { cls: 'Hype Driven', why: 'Price is rising while usage and development are falling.' };
  return { cls: 'Mixed', why: 'Signals from price, volume, usage and development point in different directions.' };
}

export function buildNarrative(f: CoinFacts, s: ScoreResult): Narrative {
  const t = f.tech;
  const comp = Object.fromEntries(s.components.map((c) => [c.key, c]));
  const strengths = s.components.filter((c) => c.key !== 'risk').map((c) => ({ c, r: c.points / c.max })).sort((a, b) => b.r - a.r);
  const whyQualified: string[] = [];
  for (const { c } of strengths.slice(0, 4)) {
    const best = c.items.filter((i) => !i.na && i.max > 0).sort((a, b) => b.points / b.max - a.points / a.max)[0];
    if (best && best.points / best.max >= 0.6) whyQualified.push(`${c.label} ${c.points}/${c.max}: ${best.detail}.`);
  }
  if (f.volume24h && f.marketCap) whyQualified.push(`Liquidity: ${usd(f.volume24h)} traded in 24h on a ${usd(f.marketCap)} market cap.`);

  const bull: string[] = [];
  if (f.tvl !== null) bull.push(`TVL (now ${usd(f.tvl)}) keeps growing, showing the product is used more.`);
  if (t?.ema50 && t.price) bull.push(`Price holds above its 50-day EMA (${priceFmt(t.ema50)}) and ${t.resistance ? `clears resistance near ${priceFmt(t.resistance)}` : 'sets new 90-day highs'}.`);
  if (f.commits4w) bull.push(`Development pace (${f.commits4w} commits in 4 weeks) continues and ships the roadmap.`);
  if (f.fdv && f.marketCap && f.fdv / f.marketCap > 1.3) bull.push('New demand absorbs future token emissions without price pressure.');
  bull.push(`The wider market stays supportive (current regime: ${f.regime.toLowerCase()}).`);

  const bear: string[] = [];
  if (f.fdv && f.marketCap && f.fdv / f.marketCap > 1.5) bear.push(`FDV is ${(f.fdv / f.marketCap).toFixed(1)}× market cap — unlocking supply could outpace demand.`);
  if ((t?.volatility30d ?? 0) > 90) bear.push(`Volatility of ${t!.volatility30d!.toFixed(0)}% a year means deep drawdowns are normal for this asset.`);
  if (t?.support) bear.push(`A break below support near ${priceFmt(t.support)} would weaken the technical picture.`);
  if (f.tvlChange30d !== null && f.tvlChange30d < 0) bear.push(`TVL already fell ${pct(f.tvlChange30d)} in 30 days.`);
  if (f.regime === 'BEARISH' || f.regime === 'HIGH VOLATILITY') bear.push(`Market regime is ${f.regime.toLowerCase()}; altcoins usually fall harder than BTC in sell-offs.`);
  bear.push('Competing projects in the same sector could take users and liquidity.');

  const whyNot: string[] = [];
  const weakest = s.components.filter((c) => c.key !== 'risk').map((c) => ({ c, r: c.points / c.max })).sort((a, b) => a.r - b.r).slice(0, 3);
  for (const { c } of weakest) {
    const worst = c.items.filter((i) => i.max > 0).sort((a, b) => a.points / a.max - b.points / b.max)[0];
    whyNot.push(`${c.label} is only ${c.points}/${c.max}${worst ? `: ${worst.detail}` : ''}.`);
  }
  for (const fl of s.flags) whyNot.push(fl.text);
  if (s.coverage < 0.75) whyNot.push(`Only ${(s.coverage * 100).toFixed(0)}% of score inputs could be measured; the rest are neutral placeholders.`);
  if ((f.marketCap ?? 0) < 100e6) whyNot.push('Small projects fail often; a large share of small-cap tokens lose most of their value.');
  whyNot.push('Holder concentration, insider wallets and exchange flows are not measured with free data sources.');

  const inval: string[] = [];
  if (t?.ema200) inval.push(`Daily close below the 200-day EMA (${priceFmt(t.ema200)}).`);
  else if (t?.support) inval.push(`Daily close below support at ${priceFmt(t.support)}.`);
  if (f.tvl !== null) inval.push(`TVL drops more than 20% from ${usd(f.tvl)}.`);
  if (f.commits4w) inval.push('Commit activity falls to zero for a month.');
  if (f.volume24h) inval.push(`24h volume falls below ${usd(f.volume24h * 0.4)} (60% lower than today).`);
  inval.push('A large unlock, security incident or delisting is announced.');

  let lowPriceNote: string | null = null;
  if (f.price !== null && f.price < 1 && f.circulating) {
    const at1 = f.circulating * 1;
    lowPriceNote = `Low price ≠ cheap. At ${priceFmt(f.price)} with ${Intl.NumberFormat('en-US', { notation: 'compact' }).format(f.circulating)} tokens circulating, the market cap is already ${usd(f.marketCap ?? f.price * f.circulating)}${f.fdv ? ` (${usd(f.fdv)} fully diluted)` : ''}. A price of $1 would mean a ${usd(at1)} market cap — ${(at1 / (f.marketCap || 1)).toFixed(0)}× today.`;
  }
  const next = f.catalysts.filter((c) => c.date && c.date >= f.today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
  const social = socialClass(f);
  const mainRisk = s.flags[0]?.text ?? bear[0] ?? 'Crypto assets can lose most or all of their value.';
  const fundamentalThesis = [
    f.categories.length ? `${f.name} operates in ${f.categories.slice(0, 2).join(' / ')}.` : `${f.name}: sector N/A.`,
    f.tvl !== null ? `Usage: ${usd(f.tvl)} TVL (${f.tvlChange30d !== null ? pct(f.tvlChange30d) + ' 30d' : 'trend N/A'}).` : 'Usage metrics: N/A from free sources.',
    f.commits4w !== null ? `Development: ${f.commits4w} commits in 4 weeks.` : 'Development: N/A.',
    f.fdv && f.marketCap ? `Tokenomics: FDV/MC ${(f.fdv / f.marketCap).toFixed(2)}×.` : '',
  ].filter(Boolean).join(' ');
  const technicalSetup = t ? `Trend ${t.momentum?.toLowerCase() ?? 'N/A'}; RSI ${t.rsi14?.toFixed(0) ?? 'N/A'}; price ${t.ema50 && t.price ? (t.price > t.ema50 ? 'above' : 'below') : '—'} 50 EMA and ${t.ema200 && t.price ? (t.price > t.ema200 ? 'above' : 'below') : '— (200 EMA N/A)'} 200 EMA; support ${t.support ? priceFmt(t.support) : 'N/A'}, resistance ${t.resistance ? priceFmt(t.resistance) : 'N/A'}.` : 'Technical data N/A.';
  return {
    whyQualified: whyQualified.slice(0, 5), bullCase: bull.slice(0, 5), bearCase: bear.slice(0, 5), whyNot: whyNot.slice(0, 7), invalidation: inval.slice(0, 5),
    lowPriceNote, keyCatalyst: next ? `${next.date}: ${next.event}` : null, mainRisk, social: social.cls, socialWhy: social.why, technicalSetup, fundamentalThesis,
  };
}
