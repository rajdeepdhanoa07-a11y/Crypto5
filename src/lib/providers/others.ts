// DeFiLlama, Fear & Greed, GitHub, CoinMarketCap, CryptoPanic.
import { getJson } from './http';

// ---------------- DeFiLlama (free, no key) ----------------
export type LlamaProtocol = { name: string; slug: string; gecko_id: string | null; tvl: number | null; change_1d: number | null; change_7d: number | null; chains: string[]; category: string | null; mcap?: number | null };
export async function llamaProtocols() {
  return getJson<LlamaProtocol[]>({ source: 'DeFiLlama /protocols', url: 'https://api.llama.fi/protocols', ttlSeconds: 3600 });
}
export type LlamaChain = { name: string; gecko_id: string | null; tvl: number; tokenSymbol: string | null };
export async function llamaChains() {
  return getJson<LlamaChain[]>({ source: 'DeFiLlama /v2/chains', url: 'https://api.llama.fi/v2/chains', ttlSeconds: 3600 });
}
export type LlamaTvlHistory = { date: number; tvl: number }[];
export async function llamaChainTvl(chain: string) {
  return getJson<LlamaTvlHistory>({ source: 'DeFiLlama /v2/historicalChainTvl', url: `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chain)}`, ttlSeconds: 6 * 3600 });
}
export type LlamaProtocolDetail = { tvl: { date: number; totalLiquidityUSD: number }[] };
export async function llamaProtocol(slug: string) {
  return getJson<LlamaProtocolDetail>({ source: 'DeFiLlama /protocol', url: `https://api.llama.fi/protocol/${encodeURIComponent(slug)}`, ttlSeconds: 6 * 3600 });
}
export type LlamaStables = { peggedAssets: { circulating: { peggedUSD?: number } }[] };
export async function llamaStablecoins() {
  return getJson<LlamaStables>({ source: 'DeFiLlama stablecoins', url: 'https://stablecoins.llama.fi/stablecoins?includePrices=false', ttlSeconds: 3600 });
}
export type LlamaFees = { protocols: { name: string; slug: string; total24h: number | null; total30d: number | null; defillamaId?: string }[] };
export async function llamaFees() {
  return getJson<LlamaFees>({ source: 'DeFiLlama /overview/fees', url: 'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true', ttlSeconds: 6 * 3600 });
}

// ---------------- Fear & Greed (alternative.me, free) ----------------
export type Fng = { data: { value: string; value_classification: string; timestamp: string }[] };
export async function fearGreed() {
  return getJson<Fng>({ source: 'alternative.me Fear & Greed', url: 'https://api.alternative.me/fng/?limit=8', ttlSeconds: 3600 });
}

// ---------------- GitHub (free; token optional) ----------------
function gh(): Record<string, string> {
  const t = process.env.GITHUB_TOKEN;
  return { 'X-GitHub-Api-Version': '2022-11-28', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
/** Weekly commit counts for the last 52 weeks (all contributors). */
export async function ghParticipation(ownerRepo: string) {
  return getJson<{ all: number[] }>({ source: 'GitHub /stats/participation', url: `https://api.github.com/repos/${ownerRepo}/stats/participation`, headers: gh(), ttlSeconds: 12 * 3600 });
}
export async function ghRepo(ownerRepo: string) {
  return getJson<{ pushed_at: string; stargazers_count: number; archived: boolean; open_issues_count: number }>({ source: 'GitHub /repos', url: `https://api.github.com/repos/${ownerRepo}`, headers: gh(), ttlSeconds: 12 * 3600 });
}
export async function ghReleases(ownerRepo: string) {
  return getJson<{ name: string; tag_name: string; published_at: string; html_url: string }[]>({ source: 'GitHub /releases', url: `https://api.github.com/repos/${ownerRepo}/releases?per_page=5`, headers: gh(), ttlSeconds: 12 * 3600 });
}

export function repoFromUrl(url: string): string | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, '')}` : null;
}

// ---------------- CoinMarketCap (optional, free basic key) ----------------
export type CmcQuote = { data: Record<string, { id: number; symbol: string; name: string; quote: { USD: { price: number; market_cap: number; volume_24h: number; fully_diluted_market_cap: number; last_updated: string } } }[]> };
export async function cmcQuotes(symbols: string[]) {
  const key = process.env.CMC_API_KEY;
  if (!key || !symbols.length) return null;
  return getJson<CmcQuote>({
    source: 'CoinMarketCap /quotes/latest',
    url: `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols.slice(0, 100).join(','))}`,
    headers: { 'X-CMC_PRO_API_KEY': key }, ttlSeconds: 15 * 60,
  });
}

// ---------------- CryptoPanic news (optional key) ----------------
export type News = { results: { title: string; url: string; published_at: string; source: { title: string; domain: string }; kind: string }[] };
export async function news(symbol: string) {
  const key = process.env.CRYPTOPANIC_API_KEY;
  if (!key) return null;
  return getJson<News>({ source: 'CryptoPanic', url: `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${key}&currencies=${encodeURIComponent(symbol.toUpperCase())}&public=true&kind=news`, ttlSeconds: 3600 });
}

/** Data sources that need a paid plan. Shown in Settings so it's clear what is and isn't measured. */
export const PAID_SOURCES = [
  { name: 'Token Terminal', provides: 'Protocol revenue, earnings, P/S ratios', status: 'Paid API — not connected' },
  { name: 'Glassnode / CryptoQuant', provides: 'Active addresses, exchange inflows/outflows, whale flows', status: 'Paid API — not connected' },
  { name: 'Dune Analytics', provides: 'Custom on-chain queries (users, transactions)', status: 'Paid API key required — not connected' },
  { name: 'Token Unlocks (tokenomist.ai)', provides: 'Vesting and unlock schedules', status: 'Paid API — enter unlocks manually under Catalysts' },
  { name: 'Block explorers (Etherscan, etc.)', provides: 'Holder concentration, contract checks', status: 'Per-chain keys — not connected' },
  { name: 'X / social APIs', provides: 'Official account activity, community growth', status: 'Paid API — not connected' },
];
