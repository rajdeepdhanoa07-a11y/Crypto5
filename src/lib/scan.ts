// The daily scan: market regime -> universe -> filters -> deep analysis -> score -> Daily 5 -> history & alerts.
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { DEFAULT_SETTINGS, type Settings } from '@/db/schema';
import * as cg from './providers/coingecko';
import * as oth from './providers/others';
import { DATA_MODE, SourceError } from './providers/http';
import { computeTechnicals, type Technicals } from './analysis/technicals';
import { classifyRegime } from './analysis/regime';
import { scoreCoin, preScore, RISK_ORDER, type CoinFacts, type RiskLevel, type Regime } from './analysis/scoring';
import { buildNarrative } from './analysis/narrative';
import { m, NA, type Metric } from './metric';

export const STABLE_SYMBOLS = new Set(['usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdd', 'fdusd', 'pyusd', 'usde', 'usds', 'frax', 'lusd', 'gusd', 'usdp', 'eurc', 'eurt', 'susd', 'crvusd', 'gho', 'usd0', 'usdb', 'usdx', 'rlusd', 'usdg']);
export function nonResearchable(c: { symbol: string; name: string; current_price: number | null }): string | null {
  if (STABLE_SYMBOLS.has(c.symbol.toLowerCase())) return 'STABLECOIN';
  if (/\b(wrapped|bridged|staked|liquid staking|restaked)\b/i.test(c.name) || /^(w|st|cb|r|we|ez|re)(btc|eth|sol|bnb)$/i.test(c.symbol)) return 'WRAPPED';
  if (/\busd\b|\bdollar\b/i.test(c.name) && c.current_price !== null && Math.abs(c.current_price - 1) < 0.02) return 'STABLECOIN';
  return null;
}

export async function getSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst();
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function inPriceFilter(p: number | null, f: Settings['priceFilter']): boolean {
  if (p === null) return false;
  switch (f) {
    case 'UNDER_0_01': return p < 0.01;
    case '0_01_0_10': return p >= 0.01 && p < 0.1;
    case '0_10_1': return p >= 0.1 && p < 1;
    case 'UNDER_1': return p < 1;
    case '1_10': return p >= 1 && p < 10;
    case 'OVER_1': return p >= 1;
    case 'OVER_10': return p >= 10;
    default: return true;
  }
}
export function inMcapBucket(mc: number | null, b: Settings['marketCap']): boolean {
  if (b === 'ANY') return true;
  if (mc === null) return false;
  return b === 'MICRO' ? mc < 50e6 : b === 'SMALL' ? mc >= 50e6 && mc < 300e6 : b === 'MID' ? mc >= 300e6 && mc < 2e9 : mc >= 2e9;
}
export function riskAllowed(r: RiskLevel, pref: Settings['riskPreference']): boolean {
  const max = { CONSERVATIVE: 0, BALANCED: 1, AGGRESSIVE: 2, SPECULATIVE: 3 }[pref];
  return RISK_ORDER.indexOf(r) <= max;
}

type Errors = { source: string; message: string }[];
async function attempt<T>(errors: Errors, source: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { errors.push({ source, message: e instanceof SourceError ? `${e.source}: ${e.message}` : e instanceof Error ? e.message : String(e) }); return null; }
}

function downsample<T>(arr: T[], every: number): T[] { return arr.filter((_, i) => i % every === 0 || i === arr.length - 1); }

export type MarketOverview = {
  btc: { price: Metric; change7d: Metric; tech: Technicals | null; chart: [number, number][] };
  eth: { price: Metric; change7d: Metric; tech: Technicals | null; chart: [number, number][] };
  totalMarketCap: Metric; volume24h: Metric; btcDominance: Metric; ethDominance: Metric; totalMcapChange24h: Metric;
  fearGreed: Metric<number> & { label?: string; history?: { v: number; t: number }[] };
  stablecoinMcap: Metric; alt7d: Metric; breadth7d: Metric;
  regime: Regime; regimeScore: number; evidence: ReturnType<typeof classifyRegime>['evidence']; regimeConfidence: string;
  usdInr: Metric; topGainers: { id: string; symbol: string; name: string; change7d: number; price: number }[]; topLosers: { id: string; symbol: string; name: string; change7d: number; price: number }[];
  dataMode: 'LIVE' | 'SAMPLE';
};

async function marketOverview(errors: Errors, markets: cg.CgMarket[]): Promise<MarketOverview> {
  const g = await attempt(errors, 'CoinGecko global', () => cg.global());
  const fng = await attempt(errors, 'Fear & Greed', () => oth.fearGreed());
  const st = await attempt(errors, 'DeFiLlama stablecoins', () => oth.llamaStablecoins());
  const rates = await attempt(errors, 'CoinGecko exchange rates', () => cg.exchangeRates());
  const btcC = await attempt(errors, 'CoinGecko BTC chart', () => cg.marketChart('bitcoin'));
  const ethC = await attempt(errors, 'CoinGecko ETH chart', () => cg.marketChart('ethereum'));
  const btcT = btcC ? computeTechnicals(btcC.data.prices.map((p) => p[1]), btcC.data.total_volumes.map((v) => v[1])) : null;
  const ethT = ethC ? computeTechnicals(ethC.data.prices.map((p) => p[1]), ethC.data.total_volumes.map((v) => v[1])) : null;
  const gAt = g ? new Date(g.data.data.updated_at * 1000).toISOString() : null;
  const alts = markets.filter((c) => !['bitcoin', 'ethereum'].includes(c.id) && !nonResearchable(c)).slice(0, 100).filter((c) => c.price_change_percentage_7d_in_currency != null);
  const alt7d = alts.length ? alts.reduce((s, c) => s + c.price_change_percentage_7d_in_currency!, 0) / alts.length : null;
  const breadth = alts.length ? (alts.filter((c) => c.price_change_percentage_7d_in_currency! > 0).length / alts.length) * 100 : null;
  const fngV = fng ? Number(fng.data.data[0]?.value) : null;
  const btcRow = markets.find((c) => c.id === 'bitcoin'), ethRow = markets.find((c) => c.id === 'ethereum');
  const reg = classifyRegime({
    btc7d: btcRow?.price_change_percentage_7d_in_currency ?? btcT?.perf7d ?? null, eth7d: ethRow?.price_change_percentage_7d_in_currency ?? ethT?.perf7d ?? null,
    alt7d, breadth7d: breadth, fearGreed: fngV, btcVol30d: btcT?.volatility30d ?? null,
    btcAboveEma50: btcT?.price && btcT.ema50 ? btcT.price > btcT.ema50 : null, totalMcapChange24h: g?.data.data.market_cap_change_percentage_24h_usd ?? null,
  });
  const stableTotal = st ? st.data.peggedAssets.reduce((s, a) => s + (a.circulating.peggedUSD ?? 0), 0) : null;
  const usdInr = rates ? rates.data.rates.inr.value / rates.data.rates.usd.value : null;
  const sorted = alts.filter((c) => (c.total_volume ?? 0) > 1e6).sort((a, b) => b.price_change_percentage_7d_in_currency! - a.price_change_percentage_7d_in_currency!);
  const mv = (c: cg.CgMarket) => ({ id: c.id, symbol: c.symbol, name: c.name, change7d: c.price_change_percentage_7d_in_currency!, price: c.current_price ?? 0 });
  const mAt = btcRow?.last_updated ?? null;
  return {
    btc: { price: m(btcRow?.current_price, 'CoinGecko /coins/markets', mAt), change7d: m(btcRow?.price_change_percentage_7d_in_currency, 'CoinGecko /coins/markets', mAt), tech: btcT, chart: btcC ? downsample(btcC.data.prices, 2) : [] },
    eth: { price: m(ethRow?.current_price, 'CoinGecko /coins/markets', mAt), change7d: m(ethRow?.price_change_percentage_7d_in_currency, 'CoinGecko /coins/markets', mAt), tech: ethT, chart: ethC ? downsample(ethC.data.prices, 2) : [] },
    totalMarketCap: g ? m(g.data.data.total_market_cap.usd, 'CoinGecko /global', gAt) : NA('CoinGecko /global'),
    volume24h: g ? m(g.data.data.total_volume.usd, 'CoinGecko /global', gAt) : NA('CoinGecko /global'),
    btcDominance: g ? m(g.data.data.market_cap_percentage.btc, 'CoinGecko /global', gAt) : NA('CoinGecko /global'),
    ethDominance: g ? m(g.data.data.market_cap_percentage.eth, 'CoinGecko /global', gAt) : NA('CoinGecko /global'),
    totalMcapChange24h: g ? m(g.data.data.market_cap_change_percentage_24h_usd, 'CoinGecko /global', gAt) : NA('CoinGecko /global'),
    fearGreed: fng ? { ...m(fngV, 'alternative.me', new Date(Number(fng.data.data[0].timestamp) * 1000).toISOString()), label: fng.data.data[0].value_classification, history: fng.data.data.map((d) => ({ v: Number(d.value), t: Number(d.timestamp) * 1000 })).reverse() } : NA('alternative.me'),
    stablecoinMcap: st ? m(stableTotal, 'DeFiLlama stablecoins', st.fetchedAt) : NA('DeFiLlama stablecoins'),
    alt7d: m(alt7d, 'Calculated from CoinGecko top-100 altcoins', mAt, { estimate: false, note: 'Simple average 7-day change of the 100 largest non-stable altcoins' }),
    breadth7d: m(breadth, 'Calculated from CoinGecko top-100 altcoins', mAt),
    regime: reg.regime, regimeScore: reg.score, evidence: reg.evidence, regimeConfidence: reg.confidence,
    usdInr: m(usdInr, 'CoinGecko /exchange_rates', rates?.fetchedAt ?? null),
    topGainers: sorted.slice(0, 5).map(mv), topLosers: sorted.slice(-5).reverse().map(mv),
    dataMode: DATA_MODE,
  };
}

type Llama = { byGecko: Map<string, oth.LlamaProtocol>; fees: Map<string, number>; at: string | null };

export type Analysis = {
  facts: CoinFacts;
  score: ReturnType<typeof scoreCoin>;
  narrative: ReturnType<typeof buildNarrative>;
  metrics: Record<string, Metric<number | string>>;
  chart: { t: number; p: number; v: number; btc?: number; eth?: number }[];
  profile: { description: string; homepage: string | null; twitter: string | null; github: string[]; explorers: string[]; platform: string | null; genesis: string | null; categories: string[] };
  exchanges: { name: string; target: string; volumeUsd: number; trust: string | null }[];
  dev: { commits4w: Metric; contributors: Metric; stars: Metric; lastPush: Metric<string>; weekly: number[]; releases: { name: string; date: string; url: string }[] };
  onchain: { tvl: Metric; tvl7d: Metric; tvl30d: Metric; fees30d: Metric; tvlHistory: { t: number; v: number }[]; notMeasured: string[] };
  community: { twitter: Metric; watchlists: Metric; sentimentUp: Metric };
  crossCheck: { field: string; coingecko: number | null; cmc: number | null; diffPct: number | null; note: string }[];
  news: { title: string; url: string; source: string; at: string }[] | null;
  catalysts: { id: number; date: string | null; kind: string; event: string; significance: string | null; risk: string | null; sourceUrl: string | null }[];
  analyzedAt: string;
  dataMode: 'LIVE' | 'SAMPLE';
};

export async function analyzeCoin(row: cg.CgMarket, ctx: { regime: Regime; alt7d: number | null; btcPrices: number[]; ethPrices: number[]; llama: Llama; settings: Settings; errors: Errors; cmc?: { data: oth.CmcQuote } | null }): Promise<Analysis> {
  const { errors } = ctx;
  const today = todayISO();
  const detail = await attempt(errors, `CoinGecko detail ${row.id}`, () => cg.coin(row.id));
  const chart = await attempt(errors, `CoinGecko chart ${row.id}`, () => cg.marketChart(row.id));
  const d = detail?.data;
  const prices = chart?.data.prices.map((p) => p[1]) ?? [];
  const vols = chart?.data.total_volumes.map((p) => p[1]) ?? [];
  const tech = prices.length >= 30 ? computeTechnicals(prices, vols) : null;
  const perfN = (arr: number[], n: number) => (arr.length > n ? ((arr[arr.length - 1] - arr[arr.length - 1 - n]) / arr[arr.length - 1 - n]) * 100 : null);
  const btc30 = perfN(ctx.btcPrices, 30), eth30 = perfN(ctx.ethPrices, 30);

  // DeFiLlama
  const proto = ctx.llama.byGecko.get(row.id);
  let tvl30: number | null = null;
  let tvlHistory: { t: number; v: number }[] = [];
  if (proto?.tvl) {
    const hist = await attempt(errors, `DeFiLlama ${proto.slug}`, () => oth.llamaProtocol(proto.slug));
    const pts = hist?.data.tvl ?? [];
    if (pts.length > 31) {
      const now = pts[pts.length - 1].totalLiquidityUSD, then = pts[pts.length - 31].totalLiquidityUSD;
      tvl30 = then > 0 ? ((now - then) / then) * 100 : null;
      tvlHistory = pts.slice(-120).map((p) => ({ t: p.date * 1000, v: p.totalLiquidityUSD }));
    }
  }
  const fees30 = proto ? ctx.llama.fees.get(proto.slug) ?? ctx.llama.fees.get(proto.name.toLowerCase()) ?? null : null;

  // Development: CoinGecko developer data, refined with GitHub when a token is configured (or in sample mode)
  const repos = (d?.links?.repos_url?.github ?? []).filter((x): x is string => !!x);
  const repo = repos.map(oth.repoFromUrl).find(Boolean) ?? null;
  let weekly: number[] = (d?.developer_data?.last_4_weeks_commit_activity_series ?? []).filter((x): x is number => typeof x === 'number');
  let devTrend: number | null = null, lastPushDays: number | null = null, releases: Analysis['dev']['releases'] = [];
  let commits4w: number | null = d?.developer_data?.commit_count_4_weeks ?? null;
  let devSource = 'CoinGecko developer_data';
  if (repo && (process.env.GITHUB_TOKEN || DATA_MODE === 'SAMPLE')) {
    const part = await attempt(errors, `GitHub ${repo}`, () => oth.ghParticipation(repo));
    const info = await attempt(errors, `GitHub ${repo}`, () => oth.ghRepo(repo));
    const rel = await attempt(errors, `GitHub ${repo}`, () => oth.ghReleases(repo));
    if (part?.data.all?.length === 52) {
      weekly = part.data.all;
      const last4 = weekly.slice(-4).reduce((a, b) => a + b, 0), prev8 = weekly.slice(-12, -4).reduce((a, b) => a + b, 0) / 2;
      commits4w = last4; devSource = 'GitHub /stats/participation (main repo)';
      devTrend = prev8 > 0 ? ((last4 - prev8) / prev8) * 100 : last4 > 0 ? 100 : 0;
    }
    if (info) lastPushDays = Math.round((Date.now() - Date.parse(info.data.pushed_at)) / 86400000);
    releases = (rel?.data ?? []).map((r) => ({ name: r.name || r.tag_name, date: r.published_at, url: r.html_url }));
  }
  const catalysts = await db.select().from(schema.catalysts).where(eq(schema.catalysts.coinId, row.id));
  const exchanges = d ? Array.from(new Map((d.tickers ?? []).filter((t) => t.market?.identifier && !t.is_anomaly && !t.is_stale).map((t) => [t.market!.identifier!, t])).values()) : [];
  const ageYears = d?.genesis_date ? (Date.now() - Date.parse(d.genesis_date)) / (365.25 * 86400000) : null;

  const facts: CoinFacts = {
    id: row.id, symbol: row.symbol, name: row.name, categories: (d?.categories ?? []).filter((x): x is string => !!x),
    price: row.current_price, marketCap: row.market_cap, fdv: row.fully_diluted_valuation, volume24h: row.total_volume,
    circulating: row.circulating_supply, totalSupply: row.total_supply, maxSupply: row.max_supply, athChangePct: row.ath_change_percentage, rank: row.market_cap_rank, ageYears,
    tech, relBtc30d: tech?.perf30d != null && btc30 != null ? tech.perf30d - btc30 : null, relEth30d: tech?.perf30d != null && eth30 != null ? tech.perf30d - eth30 : null,
    relMarket30d: null,
    tvl: proto?.tvl ?? null, tvlChange7d: proto?.change_7d ?? null, tvlChange30d: tvl30, fees30d: fees30,
    commits4w, contributors: d?.developer_data?.pull_request_contributors ?? null, devTrend, hasRepo: d ? repos.length > 0 : null, lastPushDays, recentRelease: releases[0]?.date ?? null,
    exchanges: d ? exchanges.length : null, hasDescription: !!d?.description?.en?.trim(),
    catalysts: catalysts.map((c) => ({ date: c.eventDate, kind: c.kind, event: c.event, unlockPct: c.unlockPctOfSupply, resolved: c.resolved })),
    regime: ctx.regime, marketAlt7d: ctx.alt7d, today,
  };
  const score = scoreCoin(facts, ctx.settings.minVolumeUsd);
  const narrative = buildNarrative(facts, score);
  const mAt = row.last_updated, dAt = detail?.fetchedAt ?? null, cAt = chart?.fetchedAt ?? null, lAt = ctx.llama.at;
  const S = 'CoinGecko /coins/markets', T = 'Calculated from CoinGecko daily closes';
  const metrics: Analysis['metrics'] = {
    price: m(row.current_price, S, mAt), marketCap: m(row.market_cap, S, mAt), fdv: m(row.fully_diluted_valuation, S, mAt), volume24h: m(row.total_volume, S, mAt),
    circulating: m(row.circulating_supply, S, mAt), totalSupply: m(row.total_supply, S, mAt), maxSupply: m(row.max_supply, S, mAt),
    fdvRatio: m(row.fully_diluted_valuation && row.market_cap ? row.fully_diluted_valuation / row.market_cap : null, 'Calculated: FDV ÷ market cap', mAt),
    circulatingPct: m(row.circulating_supply && (row.max_supply ?? row.total_supply) ? (row.circulating_supply / (row.max_supply ?? row.total_supply)!) * 100 : null, 'Calculated: circulating ÷ max (or total) supply', mAt),
    inflation: NA('Annual emission schedule', 'Not available from free sources; see circulating % and unlocks'),
    change24h: m(row.price_change_percentage_24h_in_currency, S, mAt), change7d: m(tech?.perf7d ?? row.price_change_percentage_7d_in_currency, T, cAt), change30d: m(tech?.perf30d ?? row.price_change_percentage_30d_in_currency, T, cAt),
    change90d: m(tech?.perf90d, T, cAt), change180d: m(tech?.perf180d, T, cAt),
    rsi14: m(tech?.rsi14, T, cAt), macd: m(tech?.macd, T, cAt), macdSignal: m(tech?.macdSignal, T, cAt), macdHist: m(tech?.macdHist, T, cAt),
    ema20: m(tech?.ema20, T, cAt), ema50: m(tech?.ema50, T, cAt), ema200: m(tech?.ema200, T, cAt, tech && tech.days < 200 ? { note: 'Needs 200 days of history' } : {}),
    volatility30d: m(tech?.volatility30d, T, cAt), volumeTrend: m(tech?.volumeTrend, 'Calculated: 7d avg vs prior 30d avg volume', cAt),
    support: m(tech?.support, 'Calculated: 90-day swing lows', cAt, { estimate: true }), resistance: m(tech?.resistance, 'Calculated: 90-day swing highs', cAt, { estimate: true }),
    vsBtc30d: m(facts.relBtc30d, 'Calculated vs BTC 30d change', cAt), vsEth30d: m(facts.relEth30d, 'Calculated vs ETH 30d change', cAt), vsMarket7d: m(tech?.perf7d != null && ctx.alt7d != null ? tech.perf7d - ctx.alt7d : null, 'Calculated vs average altcoin 7d', cAt),
    athChange: m(row.ath_change_percentage, S, mAt), rank: m(row.market_cap_rank, S, mAt), exchanges: m(d ? exchanges.length : null, 'CoinGecko tickers (non-stale)', dAt),
  };
  // Cross-check with CoinMarketCap when configured
  const crossCheck: Analysis['crossCheck'] = [];
  const cmcRow = ctx.cmc?.data.data[row.symbol.toUpperCase()]?.find((q) => q.name.toLowerCase() === row.name.toLowerCase()) ?? null;
  if (cmcRow) {
    for (const [field, a, b] of [['Price', row.current_price, cmcRow.quote.USD.price], ['Market cap', row.market_cap, cmcRow.quote.USD.market_cap], ['24h volume', row.total_volume, cmcRow.quote.USD.volume_24h]] as const) {
      const diff = a && b ? ((b - a) / a) * 100 : null;
      crossCheck.push({ field, coingecko: a, cmc: b, diffPct: diff, note: diff === null ? '' : Math.abs(diff) < 2 ? 'Sources agree' : field === '24h volume' ? 'Aggregators include different exchanges and filter suspicious volume differently' : field === 'Market cap' ? 'Sources count circulating supply differently (locked/treasury tokens)' : 'Prices are sampled at different times and from different exchanges' });
    }
  }
  let newsItems: Analysis['news'] = null;
  const nw = await attempt(errors, `CryptoPanic ${row.symbol}`, () => oth.news(row.symbol));
  if (nw) newsItems = nw.data.results.slice(0, 6).map((n) => ({ title: n.title, url: n.url, source: n.source?.title ?? n.source?.domain ?? '', at: n.published_at }));

  const btcByDay = new Map(ctx.btcPrices.map((p, i) => [i, p]));
  const n = prices.length, nb = ctx.btcPrices.length, ne = ctx.ethPrices.length;
  const chartRows = (chart?.data.prices ?? []).map(([t, p], i) => ({ t, p, v: vols[i] ?? 0, btc: btcByDay.size ? ctx.btcPrices[nb - n + i] : undefined, eth: ne ? ctx.ethPrices[ne - n + i] : undefined }));

  return {
    facts, score, narrative, metrics,
    chart: chartRows.filter((r) => r.btc !== undefined || true),
    profile: {
      description: d?.description?.en?.replace(/<[^>]+>/g, '').slice(0, 1500) ?? '', homepage: (d?.links?.homepage ?? []).find((x): x is string => !!x) ?? null,
      twitter: d?.links?.twitter_screen_name ? `https://x.com/${d.links.twitter_screen_name}` : null, github: repos.slice(0, 5), explorers: (d?.links?.blockchain_site ?? []).filter((x): x is string => !!x).slice(0, 3),
      platform: d?.asset_platform_id ?? null, genesis: d?.genesis_date ?? null, categories: facts.categories,
    },
    exchanges: exchanges.sort((a, b) => (b.converted_volume?.usd ?? 0) - (a.converted_volume?.usd ?? 0)).slice(0, 10).map((t) => ({ name: t.market?.name ?? t.market?.identifier ?? 'Unknown', target: t.target ?? '', volumeUsd: t.converted_volume?.usd ?? 0, trust: t.trust_score ?? null })),
    dev: {
      commits4w: m(commits4w, devSource, dAt), contributors: m(d?.developer_data?.pull_request_contributors, 'CoinGecko developer_data', dAt), stars: m(d?.developer_data?.stars, 'CoinGecko developer_data', dAt),
      lastPush: m(lastPushDays !== null ? `${lastPushDays} days ago` : null, 'GitHub /repos', dAt), weekly, releases,
    },
    onchain: {
      tvl: m(proto?.tvl, 'DeFiLlama /protocols', lAt), tvl7d: m(proto?.change_7d, 'DeFiLlama /protocols', lAt), tvl30d: m(tvl30, 'DeFiLlama /protocol history', lAt), fees30d: m(fees30, 'DeFiLlama /overview/fees', lAt), tvlHistory,
      notMeasured: ['Active addresses', 'Transaction count', 'New addresses', 'Whale activity', 'Exchange inflows/outflows', 'Holder concentration', 'Large-wallet accumulation'],
    },
    community: { twitter: m(d?.community_data?.twitter_followers, 'CoinGecko community_data', dAt), watchlists: m(d?.watchlist_portfolio_users, 'CoinGecko', dAt), sentimentUp: m(d?.sentiment_votes_up_percentage, 'CoinGecko user votes', dAt) },
    crossCheck, news: newsItems,
    catalysts: catalysts.map((c) => ({ id: c.id, date: c.eventDate, kind: c.kind, event: c.event, significance: c.significance, risk: c.risk, sourceUrl: c.sourceUrl })),
    analyzedAt: new Date().toISOString(), dataMode: DATA_MODE,
  };
}

async function loadLlama(errors: Errors): Promise<Llama> {
  const protos = await attempt(errors, 'DeFiLlama protocols', () => oth.llamaProtocols());
  const fees = await attempt(errors, 'DeFiLlama fees', () => oth.llamaFees());
  const byGecko = new Map<string, oth.LlamaProtocol>();
  for (const p of protos?.data ?? []) if (p.gecko_id && (!byGecko.get(p.gecko_id) || (p.tvl ?? 0) > (byGecko.get(p.gecko_id)!.tvl ?? 0))) byGecko.set(p.gecko_id, p);
  const feeMap = new Map<string, number>();
  for (const f of fees?.data.protocols ?? []) if (f.total30d) { feeMap.set(f.slug, f.total30d); feeMap.set(f.name.toLowerCase(), f.total30d); }
  return { byGecko, fees: feeMap, at: protos?.fetchedAt ?? null };
}

async function progress(scanId: number, text: string) {
  await db.update(schema.scans).set({ progress: text }).where(eq(schema.scans.id, scanId));
}

// On hosted plans a function can be stopped after ~5 minutes. The scan keeps within a time budget,
// and any scan still marked RUNNING after 6 minutes is treated as stopped so a new one can start.
const BUDGET_MS = Number(process.env.SCAN_BUDGET_SECONDS ?? (process.env.VERCEL ? 230 : 3600)) * 1000;
const STALE_MINUTES = process.env.VERCEL ? 6 : 20;
export async function expireStaleScans() {
  await db.update(schema.scans).set({ status: 'FAILED', finishedAt: new Date(), progress: 'Stopped by the hosting time limit before finishing. Run the scan again; results are cached so it will be faster.' })
    .where(and(eq(schema.scans.status, 'RUNNING'), sql`${schema.scans.startedAt} < now() - make_interval(mins => ${STALE_MINUTES})`));
}

export async function startScan(trigger: 'MANUAL' | 'AUTO'): Promise<number> {
  await expireStaleScans();
  const running = await db.query.scans.findFirst({ where: eq(schema.scans.status, 'RUNNING') });
  if (running) return running.id;
  const settings = await getSettings();
  const [s] = await db.insert(schema.scans).values({ scanDate: todayISO(), trigger, status: 'RUNNING', progress: 'Starting…', dataMode: DATA_MODE, settings }).returning();
  return s.id;
}

export async function runScan(scanId: number): Promise<void> {
  const errors: Errors = [];
  const settings = await getSettings();
  const t0 = Date.now();
  try {
    // 1. Universe
    const markets: cg.CgMarket[] = [];
    for (let page = 1; page <= settings.universePages; page++) {
      await progress(scanId, `Fetching market data (page ${page} of ${settings.universePages})…`);
      const r = await attempt(errors, `CoinGecko markets page ${page}`, () => cg.markets(page));
      if (!r) { if (page === 1) throw new Error('Could not load market data from CoinGecko. Check your API key and try again.'); break; }
      markets.push(...r.data);
      if (r.data.length < 250) break;
    }
    // 2. Market regime
    await progress(scanId, 'Analysing market regime…');
    const market = await marketOverview(errors, markets);
    const llama = await loadLlama(errors);

    // 3. Save universe + price snapshot
    await progress(scanId, `Saving ${markets.length} coins…`);
    const today = todayISO();
    for (let i = 0; i < markets.length; i += 500) {
      const chunk = markets.slice(i, i + 500);
      await db.insert(schema.universe).values(chunk.map((c) => ({
        coinId: c.id, symbol: c.symbol, name: c.name, image: c.image, rank: c.market_cap_rank, priceUsd: c.current_price, marketCap: c.market_cap, fdv: c.fully_diluted_valuation, volume24h: c.total_volume,
        change24h: c.price_change_percentage_24h_in_currency ?? null, change7d: c.price_change_percentage_7d_in_currency ?? null, change30d: c.price_change_percentage_30d_in_currency ?? null, change200d: c.price_change_percentage_200d_in_currency ?? null,
        circulating: c.circulating_supply, totalSupply: c.total_supply, maxSupply: c.max_supply, athChangePct: c.ath_change_percentage,
        tvl: llama.byGecko.get(c.id)?.tvl ?? null, sector: llama.byGecko.get(c.id)?.category ?? null, chain: llama.byGecko.get(c.id)?.chains?.[0] ?? null,
        excludedType: nonResearchable(c), scanId, sourceAt: c.last_updated ? new Date(c.last_updated) : null, updatedAt: new Date(),
      }))).onConflictDoUpdate({ target: schema.universe.coinId, set: {
        symbol: sql`excluded.symbol`, name: sql`excluded.name`, image: sql`excluded.image`, rank: sql`excluded.rank`, priceUsd: sql`excluded.price_usd`, marketCap: sql`excluded.market_cap`, fdv: sql`excluded.fdv`, volume24h: sql`excluded.volume_24h`,
        change24h: sql`excluded.change_24h`, change7d: sql`excluded.change_7d`, change30d: sql`excluded.change_30d`, change200d: sql`excluded.change_200d`, circulating: sql`excluded.circulating`, totalSupply: sql`excluded.total_supply`, maxSupply: sql`excluded.max_supply`,
        athChangePct: sql`excluded.ath_change_pct`, tvl: sql`excluded.tvl`, sector: sql`coalesce(excluded.sector, universe.sector)`, chain: sql`coalesce(excluded.chain, universe.chain)`, excludedType: sql`excluded.excluded_type`, scanId: sql`excluded.scan_id`, sourceAt: sql`excluded.source_at`, updatedAt: sql`excluded.updated_at`,
      } });
      await db.insert(schema.priceSnapshots).values(chunk.map((c) => ({ snapDate: today, coinId: c.id, priceUsd: c.current_price, marketCap: c.market_cap, volume24h: c.total_volume })))
        .onConflictDoUpdate({ target: [schema.priceSnapshots.snapDate, schema.priceSnapshots.coinId], set: { priceUsd: sql`excluded.price_usd`, marketCap: sql`excluded.market_cap`, volume24h: sql`excluded.volume_24h` } });
    }

    // 4. Eligibility + pre-score
    const researchable = markets.filter((c) => !nonResearchable(c) && c.current_price !== null && c.market_cap);
    const eligible = researchable.filter((c) => inPriceFilter(c.current_price, settings.priceFilter) && inMcapBucket(c.market_cap, settings.marketCap) && (c.total_volume ?? 0) >= settings.minVolumeUsd);
    const pre = eligible.map((c) => ({ c, s: preScore({ marketCap: c.market_cap, volume24h: c.total_volume, fdv: c.fully_diluted_valuation, change7d: c.price_change_percentage_7d_in_currency ?? null, change30d: c.price_change_percentage_30d_in_currency ?? null, circulating: c.circulating_supply, maxSupply: c.max_supply, totalSupply: c.total_supply }) }))
      .sort((a, b) => b.s - a.s);
    const watch = await db.select().from(schema.watchlist);
    const deep = new Map<string, cg.CgMarket>();
    for (const { c } of pre.slice(0, settings.deepAnalyze)) deep.set(c.id, c);
    for (const w of watch) { const r = markets.find((c) => c.id === w.coinId); if (r) deep.set(r.id, r); }
    const alerts = await db.select().from(schema.alerts).where(eq(schema.alerts.active, true));
    for (const a of alerts) { const r = markets.find((c) => c.id === a.coinId); if (r) deep.set(r.id, r); }

    // 5. Deep analysis
    const btcPrices = market.btc.chart.length ? (await attempt(errors, 'BTC chart', () => cg.marketChart('bitcoin')))?.data.prices.map((p) => p[1]) ?? [] : [];
    const ethPrices = market.eth.chart.length ? (await attempt(errors, 'ETH chart', () => cg.marketChart('ethereum')))?.data.prices.map((p) => p[1]) ?? [] : [];
    const cmc = await attempt(errors, 'CoinMarketCap', () => oth.cmcQuotes(Array.from(deep.values()).map((c) => c.symbol.toUpperCase())));
    const results: { row: cg.CgMarket; a: Analysis }[] = [];
    let i = 0;
    for (const row of Array.from(deep.values())) {
      if (Date.now() - t0 > BUDGET_MS) {
        errors.push({ source: 'time limit', message: `Stopped after analysing ${i} of ${deep.size} coins to stay within the hosting time limit. The Daily 5 was chosen from the coins analysed. A free CoinGecko key makes scans faster.` });
        break;
      }
      i++;
      await progress(scanId, `Analysing ${row.name} (${i} of ${deep.size})…`);
      try {
        results.push({ row, a: await analyzeCoin(row, { regime: market.regime, alt7d: market.alt7d.value, btcPrices, ethPrices, llama, settings, errors, cmc }) });
      } catch (e) {
        // One coin with unusual data must not stop the whole scan.
        errors.push({ source: `Analysis ${row.name}`, message: `Skipped: ${e instanceof Error ? e.message : String(e)}` });
      }
    }

    // 6. Select the Daily 5 (eligible, no serious red flags, within risk preference, ≥50% data coverage, max 2 per sector)
    const pool = results.filter(({ row, a }) => eligible.some((e) => e.id === row.id) && !a.score.excluded && riskAllowed(a.score.risk, settings.riskPreference) && a.score.coverage >= 0.5)
      .sort((x, y) => y.a.score.total - x.a.score.total);
    const picks: string[] = [];
    const perSector = new Map<string, number>();
    for (const { row, a } of pool) {
      const sector = a.facts.categories[0] ?? 'Other';
      if ((perSector.get(sector) ?? 0) >= 2) continue;
      picks.push(row.id); perSector.set(sector, (perSector.get(sector) ?? 0) + 1);
      if (picks.length === 5) break;
    }

    await progress(scanId, 'Saving results…');
    for (const { row, a } of results) {
      const rank = picks.indexOf(row.id) + 1 || null;
      await db.insert(schema.scanCoins).values({
        scanId, coinId: row.id, symbol: row.symbol, name: row.name, image: row.image, selected: !!rank, rank,
        priceUsd: row.current_price, marketCap: row.market_cap, fdv: row.fully_diluted_valuation, volume24h: row.total_volume,
        change7d: a.metrics.change7d.value as number | null, change30d: a.metrics.change30d.value as number | null, change90d: a.metrics.change90d.value as number | null,
        score: a.score.total, riskLevel: a.score.risk, excluded: a.score.excluded, reason: rank ? a.narrative.whyQualified[0] ?? null : a.score.excludeReason,
        analysis: a as unknown as Record<string, unknown>,
      });
    }
    await evaluateAlerts(scanId, markets, results.map((r) => r.a));
    await db.update(schema.scans).set({
      status: 'DONE', finishedAt: new Date(), progress: picks.length < 5 ? `Only ${picks.length} coins met every requirement today.` : 'Complete', market: market as unknown as Record<string, unknown>,
      universeCount: markets.length, eligibleCount: eligible.length, analyzedCount: results.length, errors,
    }).where(eq(schema.scans.id, scanId));
    // Keep price snapshots for a year
    await db.delete(schema.priceSnapshots).where(lt(schema.priceSnapshots.snapDate, new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)));
  } catch (e) {
    errors.push({ source: 'scan', message: e instanceof Error ? e.message : String(e) });
    await db.update(schema.scans).set({ status: 'FAILED', finishedAt: new Date(), progress: e instanceof Error ? e.message : 'Scan failed', errors }).where(eq(schema.scans.id, scanId));
  }
}

/** Deep-analyse a single coin on demand (coin page "Analyse now"). Stored against the latest scan. */
export async function analyzeSingle(coinId: string): Promise<boolean> {
  const errors: Errors = [];
  const settings = await getSettings();
  const latest = await db.query.scans.findFirst({ where: eq(schema.scans.status, 'DONE'), orderBy: [desc(schema.scans.id)] });
  if (!latest) return false;
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, coinId) });
  if (!u) return false;
  const market = latest.market as unknown as MarketOverview;
  const row: cg.CgMarket = {
    id: u.coinId, symbol: u.symbol, name: u.name, image: u.image ?? '', current_price: u.priceUsd, market_cap: u.marketCap, market_cap_rank: u.rank, fully_diluted_valuation: u.fdv, total_volume: u.volume24h,
    high_24h: null, low_24h: null, circulating_supply: u.circulating, total_supply: u.totalSupply, max_supply: u.maxSupply, ath: null, ath_change_percentage: u.athChangePct, ath_date: null, atl: null,
    last_updated: u.sourceAt?.toISOString() ?? null, price_change_percentage_24h_in_currency: u.change24h, price_change_percentage_7d_in_currency: u.change7d, price_change_percentage_30d_in_currency: u.change30d,
  };
  const btc = await attempt(errors, 'BTC chart', () => cg.marketChart('bitcoin'));
  const eth = await attempt(errors, 'ETH chart', () => cg.marketChart('ethereum'));
  const a = await analyzeCoin(row, { regime: market.regime, alt7d: market.alt7d.value, btcPrices: btc?.data.prices.map((p) => p[1]) ?? [], ethPrices: eth?.data.prices.map((p) => p[1]) ?? [], llama: await loadLlama(errors), settings, errors });
  await db.delete(schema.scanCoins).where(and(eq(schema.scanCoins.scanId, latest.id), eq(schema.scanCoins.coinId, coinId), eq(schema.scanCoins.selected, false)));
  const existing = await db.query.scanCoins.findFirst({ where: and(eq(schema.scanCoins.scanId, latest.id), eq(schema.scanCoins.coinId, coinId)) });
  const values = {
    scanId: latest.id, coinId, symbol: row.symbol, name: row.name, image: row.image, priceUsd: row.current_price, marketCap: row.market_cap, fdv: row.fully_diluted_valuation, volume24h: row.total_volume,
    change7d: a.metrics.change7d.value as number | null, change30d: a.metrics.change30d.value as number | null, change90d: a.metrics.change90d.value as number | null,
    score: a.score.total, riskLevel: a.score.risk, excluded: a.score.excluded, reason: a.score.excludeReason, analysis: a as unknown as Record<string, unknown>,
  };
  if (existing) await db.update(schema.scanCoins).set(values).where(eq(schema.scanCoins.id, existing.id));
  else await db.insert(schema.scanCoins).values(values);
  return true;
}

async function evaluateAlerts(scanId: number, markets: cg.CgMarket[], analyses: Analysis[]) {
  const active = await db.select().from(schema.alerts).where(eq(schema.alerts.active, true));
  if (!active.length) return;
  const ids = Array.from(new Set(active.map((a) => a.coinId)));
  const prevDate = await db.select({ d: schema.priceSnapshots.snapDate }).from(schema.priceSnapshots).where(lt(schema.priceSnapshots.snapDate, todayISO())).orderBy(desc(schema.priceSnapshots.snapDate)).limit(1);
  const prev = prevDate[0] ? await db.select().from(schema.priceSnapshots).where(and(eq(schema.priceSnapshots.snapDate, prevDate[0].d), inArray(schema.priceSnapshots.coinId, ids))) : [];
  const catalysts = await db.select().from(schema.catalysts).where(inArray(schema.catalysts.coinId, ids));
  for (const al of active) {
    const row = markets.find((c) => c.id === al.coinId);
    const an = analyses.find((a) => a.facts.id === al.coinId);
    let value: number | null = null, label = '';
    switch (al.type) {
      case 'PRICE': value = row?.current_price ?? null; label = 'Price'; break;
      case 'MARKET_CAP': value = row?.market_cap ?? null; label = 'Market cap'; break;
      case 'VOLUME_CHANGE': { const p = prev.find((x) => x.coinId === al.coinId); value = p?.volume24h && row?.total_volume ? ((row.total_volume - p.volume24h) / p.volume24h) * 100 : null; label = 'Volume change vs previous scan (%)'; break; }
      case 'RSI': value = an?.facts.tech?.rsi14 ?? null; label = 'RSI(14)'; break;
      case 'TVL_CHANGE': value = an?.facts.tvlChange7d ?? null; label = 'TVL 7-day change (%)'; break;
      case 'DEV_CHANGE': value = an?.facts.devTrend ?? null; label = 'Commit activity change (%)'; break;
      case 'UNLOCK': { const soon = catalysts.filter((c) => c.coinId === al.coinId && c.kind === 'UNLOCK' && c.eventDate && c.eventDate >= todayISO()).map((c) => Math.round((Date.parse(c.eventDate!) - Date.now()) / 86400000)); value = soon.length ? Math.min(...soon) : null; label = 'Days until next recorded unlock'; break; }
    }
    if (value === null) continue;
    const hit = al.operator === 'ABOVE' ? value > al.threshold : value < al.threshold;
    if (!hit) continue;
    if (al.lastTriggeredAt && Date.now() - al.lastTriggeredAt.getTime() < 20 * 3600 * 1000) continue;
    await db.insert(schema.alertEvents).values({ alertId: al.id, coinId: al.coinId, value, message: `${al.symbol.toUpperCase()}: ${label} is ${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} (${al.operator === 'ABOVE' ? 'above' : 'below'} ${al.threshold.toLocaleString('en-US')}). Scan #${scanId}.` });
    await db.update(schema.alerts).set({ lastTriggeredAt: new Date() }).where(eq(schema.alerts.id, al.id));
  }
}
