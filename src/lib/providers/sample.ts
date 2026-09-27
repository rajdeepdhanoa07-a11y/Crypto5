// SAMPLE MODE ONLY (DATA_MODE=SAMPLE). Deterministic, fictional market data used to test the
// app where the real APIs are unreachable. Every screen shows a "SAMPLE DATA" banner in this
// mode. Never used when DATA_MODE=LIVE.

type Rng = () => number;
function rng(seed: number): Rng { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hash(str: string): number { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
function gauss(r: Rng) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

const SYL = ['ar', 'bo', 'ce', 'da', 'el', 'fi', 'ga', 'hu', 'io', 'ja', 'ka', 'lu', 'mo', 'nex', 'or', 'pi', 'qu', 'ra', 'sol', 'ta', 'ul', 'vo', 'wi', 'xo', 'ya', 'ze', 'tri', 'fla', 'gri', 'pra', 'sta', 'ven'];
const SUFFIX = ['Network', 'Protocol', 'Chain', 'Finance', 'Labs', 'DAO', 'Swap', 'AI', 'Link', 'Pay'];
const CATEGORIES = [['Layer 1 (L1)', 'Smart Contract Platform'], ['Decentralized Finance (DeFi)', 'Decentralized Exchange (DEX)'], ['Decentralized Finance (DeFi)', 'Lending/Borrowing'], ['Layer 2 (L2)', 'Ethereum Ecosystem'], ['Artificial Intelligence (AI)'], ['Gaming (GameFi)'], ['Oracle'], ['Real World Assets (RWA)'], ['Meme'], ['Infrastructure', 'Data Availability'], ['Payments']];

export type SampleCoin = {
  id: string; symbol: string; name: string; cat: string[]; price0: number; drift: number; vol: number; circ: number; total: number; max: number | null;
  volRatio: number; tvl: number | null; tvlTrend: number; commits: number; devTrend: number; exchanges: number; kind: 'normal' | 'stable' | 'wrapped' | 'wash' | 'pump' | 'dead' | 'overhang' | 'btc' | 'eth';
};

const DAYS = 365;
const NOW = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

let universe: SampleCoin[] | null = null;
function build(): SampleCoin[] {
  if (universe) return universe;
  const r = rng(424242);
  const out: SampleCoin[] = [
    { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', cat: ['Layer 1 (L1)'], price0: 61000, drift: 0.0009, vol: 0.028, circ: 19.7e6, total: 19.7e6, max: 21e6, volRatio: 0.025, tvl: null, tvlTrend: 0, commits: 60, devTrend: 0, exchanges: 100, kind: 'btc' },
    { id: 'ethereum', symbol: 'eth', name: 'Ethereum', cat: ['Layer 1 (L1)', 'Smart Contract Platform'], price0: 3100, drift: 0.0006, vol: 0.035, circ: 120.3e6, total: 120.3e6, max: null, volRatio: 0.04, tvl: 6.1e10, tvlTrend: 0.001, commits: 110, devTrend: 0, exchanges: 100, kind: 'eth' },
    { id: 'tether', symbol: 'usdt', name: 'Tether', cat: ['Stablecoins'], price0: 1, drift: 0, vol: 0.0005, circ: 118e9, total: 118e9, max: null, volRatio: 0.4, tvl: null, tvlTrend: 0, commits: 0, devTrend: 0, exchanges: 100, kind: 'stable' },
    { id: 'usd-coin', symbol: 'usdc', name: 'USDC', cat: ['Stablecoins'], price0: 1, drift: 0, vol: 0.0005, circ: 35e9, total: 35e9, max: null, volRatio: 0.2, tvl: null, tvlTrend: 0, commits: 0, devTrend: 0, exchanges: 100, kind: 'stable' },
    { id: 'wrapped-bitcoin', symbol: 'wbtc', name: 'Wrapped Bitcoin', cat: ['Wrapped-Tokens'], price0: 61000, drift: 0.0009, vol: 0.028, circ: 150000, total: 150000, max: null, volRatio: 0.02, tvl: null, tvlTrend: 0, commits: 0, devTrend: 0, exchanges: 40, kind: 'wrapped' },
  ];
  for (let i = 0; i < 620; i++) {
    const name = (SYL[Math.floor(r() * SYL.length)] + SYL[Math.floor(r() * SYL.length)]).replace(/^./, (c) => c.toUpperCase()) + (r() > 0.5 ? ' ' + SUFFIX[Math.floor(r() * SUFFIX.length)] : '');
    const symbol = name.replace(/[^A-Za-z]/g, '').slice(0, 3 + Math.floor(r() * 2)).toLowerCase() + (i % 7 === 0 ? 'x' : '');
    const logPrice = -4.5 + r() * 6.5; // 0.00003 .. 100
    const mcapLog = 6 + r() * 4.2; // $1M .. ~$16B
    const price0 = 10 ** logPrice;
    const circ = 10 ** mcapLog / price0;
    const unlockedShare = 0.12 + r() * 0.88;
    const kindRoll = r();
    const kind: SampleCoin['kind'] = kindRoll < 0.03 ? 'wash' : kindRoll < 0.05 ? 'pump' : kindRoll < 0.09 ? 'dead' : kindRoll < 0.14 ? 'overhang' : 'normal';
    const cat = CATEGORIES[Math.floor(r() * CATEGORIES.length)];
    const hasTvl = cat[0].includes('DeFi') || cat[0].includes('Layer') || (r() > 0.7 && !cat.includes('Meme'));
    out.push({
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`, symbol, name, cat, price0,
      drift: kind === 'dead' ? -0.006 : kind === 'pump' ? 0.001 : (r() - 0.45) * 0.006,
      vol: kind === 'pump' ? 0.09 : 0.03 + r() * 0.07,
      circ, total: circ / (kind === 'overhang' ? 0.1 : unlockedShare), max: r() > 0.3 ? circ / (kind === 'overhang' ? 0.08 : unlockedShare * (0.8 + r() * 0.2)) : null,
      volRatio: kind === 'wash' ? 2.4 + r() * 3 : kind === 'dead' ? 0.002 : 0.01 + r() ** 2 * 0.4,
      tvl: hasTvl && kind !== 'dead' ? 10 ** mcapLog * (0.05 + r() * 1.4) : null, tvlTrend: (r() - 0.4) * 0.012,
      commits: kind === 'dead' ? 0 : cat.includes('Meme') ? Math.floor(r() * 4) : Math.floor(r() ** 1.5 * 180), devTrend: (r() - 0.5) * 0.6,
      exchanges: kind === 'dead' ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() ** 2 * 60), kind,
    });
  }
  universe = out;
  return out;
}

const series = new Map<string, number[]>();
function priceSeries(c: SampleCoin): number[] {
  const hit = series.get(c.id);
  if (hit) return hit;
  const r = rng(hash(c.id));
  const p: number[] = [c.price0];
  for (let d = 1; d <= DAYS; d++) {
    let ret = c.drift + c.vol * gauss(r);
    if (c.kind === 'pump' && d > DAYS - 6) ret = 0.13 + 0.03 * r();
    if (c.kind === 'btc' || c.kind === 'eth') ret = c.drift + c.vol * gauss(r) * 0.8;
    p.push(Math.max(p[d - 1] * Math.exp(ret), 1e-9));
  }
  // Rescale so today's price equals the coin's configured price (keeps market caps realistic)
  const k = c.price0 / p[DAYS];
  for (let d = 0; d <= DAYS; d++) p[d] *= k;
  if (c.kind === 'stable') for (let d = 0; d <= DAYS; d++) p[d] = 1 + (r() - 0.5) * 0.002;
  series.set(c.id, p);
  return p;
}

function pct(a: number, b: number) { return ((b - a) / a) * 100; }

function marketRow(c: SampleCoin) {
  const p = priceSeries(c);
  const price = p[DAYS];
  const mcap = price * c.circ;
  const ath = Math.max(...p) * (c.kind === 'dead' ? 40 : 1.3);
  return {
    id: c.id, symbol: c.symbol, name: c.name, image: '',
    current_price: price, market_cap: mcap, market_cap_rank: 0, fully_diluted_valuation: price * (c.max ?? c.total),
    total_volume: mcap * c.volRatio, high_24h: price * 1.03, low_24h: price * 0.97,
    circulating_supply: c.circ, total_supply: c.total, max_supply: c.max,
    ath, ath_change_percentage: pct(ath, price), ath_date: '2021-11-10T00:00:00.000Z', atl: Math.min(...p) * 0.5,
    last_updated: new Date().toISOString(),
    price_change_percentage_24h_in_currency: pct(p[DAYS - 1], price),
    price_change_percentage_7d_in_currency: pct(p[DAYS - 7], price),
    price_change_percentage_30d_in_currency: pct(p[DAYS - 30], price),
    price_change_percentage_200d_in_currency: pct(p[DAYS - 200], price),
    price_change_percentage_1y_in_currency: pct(p[0], price),
  };
}

function ranked() {
  const rows = build().map(marketRow).sort((a, b) => b.market_cap - a.market_cap);
  rows.forEach((r, i) => (r.market_cap_rank = i + 1));
  return rows;
}

export function sampleResponse(url: string): unknown {
  const u = new URL(url);
  const path = u.pathname;
  const coins = build();
  if (path.endsWith('/coins/markets')) {
    const page = Number(u.searchParams.get('page') ?? 1), per = Number(u.searchParams.get('per_page') ?? 250);
    return ranked().slice((page - 1) * per, page * per);
  }
  if (path.endsWith('/global')) {
    const rows = ranked();
    const total = rows.reduce((s, x) => s + x.market_cap, 0) * 1.08;
    const vol = rows.reduce((s, x) => s + x.total_volume, 0);
    const btc = rows.find((x) => x.id === 'bitcoin')!, eth = rows.find((x) => x.id === 'ethereum')!;
    return { data: { total_market_cap: { usd: total }, total_volume: { usd: vol }, market_cap_percentage: { btc: (btc.market_cap / total) * 100, eth: (eth.market_cap / total) * 100 }, market_cap_change_percentage_24h_usd: 0.8, active_cryptocurrencies: 14000, updated_at: Math.floor(Date.now() / 1000) } };
  }
  const chart = path.match(/\/coins\/([^/]+)\/market_chart$/);
  if (chart) {
    const c = coins.find((x) => x.id === decodeURIComponent(chart[1]));
    if (!c) return undefined;
    const p = priceSeries(c);
    const t0 = NOW() - DAYS * 86400000;
    const r = rng(hash(c.id + 'v'));
    return {
      prices: p.map((v, i) => [t0 + i * 86400000, v]),
      market_caps: p.map((v, i) => [t0 + i * 86400000, v * c.circ]),
      total_volumes: p.map((v, i) => [t0 + i * 86400000, v * c.circ * c.volRatio * (0.6 + r() * 0.8) * (c.kind === 'pump' && i > DAYS - 6 ? 4 : 1)]),
    };
  }
  const detail = path.match(/\/coins\/([^/]+)$/);
  if (detail) {
    const c = coins.find((x) => x.id === decodeURIComponent(detail[1]));
    if (!c) return undefined;
    const row = marketRow(c);
    const r = rng(hash(c.id + 'd'));
    const series4 = Array.from({ length: 4 }, () => Math.max(0, Math.round((c.commits / 4) * (0.6 + r() * 0.8))));
    return {
      id: c.id, symbol: c.symbol, name: c.name, categories: c.cat,
      description: { en: c.kind === 'btc' || c.kind === 'eth' ? `${c.name} (sample data).` : `SAMPLE DATA — ${c.name} is a fictional ${c.cat[0].toLowerCase()} project generated for testing. It is not a real cryptocurrency.` },
      links: { homepage: [`https://example.com/${c.id}`], blockchain_site: [], twitter_screen_name: null, subreddit_url: null, repos_url: { github: c.commits > 0 || c.kind === 'dead' ? [`https://github.com/sample-org/${c.id}`] : [] } },
      genesis_date: `20${17 + Math.floor(r() * 7)}-0${1 + Math.floor(r() * 8)}-15`, asset_platform_id: c.cat[0].includes('Layer 1') ? null : 'ethereum', platforms: {},
      image: { large: '', small: '' }, sentiment_votes_up_percentage: 50 + r() * 40, watchlist_portfolio_users: Math.floor(r() * 90000),
      market_data: {
        current_price: { usd: row.current_price }, market_cap: { usd: row.market_cap }, fully_diluted_valuation: { usd: row.fully_diluted_valuation }, total_volume: { usd: row.total_volume },
        circulating_supply: c.circ, total_supply: c.total, max_supply: c.max,
        price_change_percentage_7d: row.price_change_percentage_7d_in_currency, price_change_percentage_30d: row.price_change_percentage_30d_in_currency, price_change_percentage_60d: null,
        price_change_percentage_200d: row.price_change_percentage_200d_in_currency, ath: { usd: row.ath }, ath_change_percentage: { usd: row.ath_change_percentage }, last_updated: new Date().toISOString(),
      },
      community_data: { twitter_followers: Math.floor(r() * 400000), reddit_subscribers: null, telegram_channel_user_count: null },
      developer_data: { forks: Math.floor(c.commits * 3 * r()), stars: Math.floor(c.commits * 12 * r()), subscribers: null, total_issues: null, closed_issues: null, pull_requests_merged: Math.floor(c.commits * 2), pull_request_contributors: Math.max(0, Math.floor(c.commits / 6)), commit_count_4_weeks: c.commits, code_additions_deletions_4_weeks: { additions: c.commits * 120, deletions: c.commits * -60 }, last_4_weeks_commit_activity_series: series4 },
      tickers: Array.from({ length: c.exchanges }, (_, i) => ({ market: { name: `Exchange ${i + 1}`, identifier: `ex${i + 1}` }, target: 'USDT', converted_volume: { usd: row.total_volume / c.exchanges }, trust_score: i % 5 === 4 ? 'yellow' : 'green', is_anomaly: false, is_stale: c.kind === 'dead' })),
      last_updated: new Date().toISOString(),
    };
  }
  if (path.endsWith('/exchange_rates')) return { rates: { usd: { value: marketRow(coins[0]).current_price, unit: '$' }, inr: { value: marketRow(coins[0]).current_price * 83.4, unit: '₹' } } };
  if (u.host === 'api.llama.fi' && path === '/protocols') {
    return coins.filter((c) => c.tvl && c.kind !== 'eth').map((c) => ({ name: c.name, slug: c.id, gecko_id: c.id, tvl: c.tvl, change_1d: c.tvlTrend * 100, change_7d: c.tvlTrend * 700, chains: ['Ethereum'], category: c.cat[1] ?? c.cat[0] }));
  }
  if (u.host === 'api.llama.fi' && path === '/v2/chains') return [{ name: 'Ethereum', gecko_id: 'ethereum', tvl: 6.1e10, tokenSymbol: 'ETH' }];
  const proto = path.match(/^\/protocol\/(.+)$/) ?? path.match(/^\/v2\/historicalChainTvl\/(.+)$/);
  if (u.host === 'api.llama.fi' && proto) {
    const key = decodeURIComponent(proto[1]).toLowerCase();
    const c = coins.find((x) => x.id === key || x.name.toLowerCase() === key);
    if (!c?.tvl) return undefined;
    const pts = Array.from({ length: 120 }, (_, i) => ({ date: Math.floor((NOW() - (119 - i) * 86400000) / 1000), tvl: c.tvl! * Math.exp(c.tvlTrend * (i - 119)) }));
    return path.startsWith('/protocol/') ? { tvl: pts.map((x) => ({ date: x.date, totalLiquidityUSD: x.tvl })) } : pts;
  }
  if (u.host === 'api.llama.fi' && path === '/overview/fees') return { protocols: coins.filter((c) => c.tvl).slice(0, 80).map((c) => ({ name: c.name, slug: c.id, total24h: c.tvl! * 0.0004, total30d: c.tvl! * 0.012 })) };
  if (u.host === 'stablecoins.llama.fi') return { peggedAssets: [{ circulating: { peggedUSD: 118e9 } }, { circulating: { peggedUSD: 35e9 } }, { circulating: { peggedUSD: 12e9 } }] };
  if (u.host === 'api.alternative.me') return { data: [58, 55, 52, 49, 51, 47, 44, 46].map((v, i) => ({ value: String(v), value_classification: v >= 55 ? 'Greed' : v >= 45 ? 'Neutral' : 'Fear', timestamp: String(Math.floor((Date.now() - i * 86400000) / 1000)) })) };
  if (u.host === 'api.github.com') {
    const repo = path.split('/').slice(2, 4).join('/');
    const c = coins.find((x) => repo.endsWith('/' + x.id));
    if (!c) return undefined;
    if (path.endsWith('/stats/participation')) { const r = rng(hash(c.id + 'g')); return { all: Array.from({ length: 52 }, (_, i) => Math.max(0, Math.round((c.commits / 4) * (1 + c.devTrend * (i - 40) / 12) * (0.5 + r())))) }; }
    if (path.endsWith('/releases')) return c.commits > 20 ? [{ name: 'v2.3.0 (sample)', tag_name: 'v2.3.0', published_at: new Date(NOW() - 18 * 86400000).toISOString(), html_url: 'https://example.com/release' }] : [];
    return { pushed_at: new Date(NOW() - (c.commits ? 2 : 400) * 86400000).toISOString(), stargazers_count: c.commits * 10, archived: c.kind === 'dead', open_issues_count: 12 };
  }
  return undefined;
}
