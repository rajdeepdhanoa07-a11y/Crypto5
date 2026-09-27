// CoinGecko API v3 (free Demo key or paid Pro key). Docs: https://docs.coingecko.com
import { getJson } from './http';

const PRO = (process.env.COINGECKO_PLAN ?? 'demo').toLowerCase() === 'pro';
const BASE = PRO ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
function headers(): Record<string, string> {
  const k = process.env.COINGECKO_API_KEY;
  if (!k) return {};
  return PRO ? { 'x-cg-pro-api-key': k } : { 'x-cg-demo-api-key': k };
}
export const CG = 'CoinGecko';

export type CgMarket = {
  id: string; symbol: string; name: string; image: string;
  current_price: number | null; market_cap: number | null; market_cap_rank: number | null; fully_diluted_valuation: number | null;
  total_volume: number | null; high_24h: number | null; low_24h: number | null;
  circulating_supply: number | null; total_supply: number | null; max_supply: number | null;
  ath: number | null; ath_change_percentage: number | null; ath_date: string | null; atl: number | null;
  last_updated: string | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  price_change_percentage_200d_in_currency?: number | null;
  price_change_percentage_1y_in_currency?: number | null;
};

export async function markets(page: number, perPage = 250) {
  return getJson<CgMarket[]>({
    source: `${CG} /coins/markets`,
    url: `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h,7d,30d,200d,1y`,
    headers: headers(), ttlSeconds: 15 * 60,
  });
}

export type CgGlobal = { data: { total_market_cap: Record<string, number>; total_volume: Record<string, number>; market_cap_percentage: Record<string, number>; market_cap_change_percentage_24h_usd: number; active_cryptocurrencies: number; updated_at: number } };
export async function global() {
  return getJson<CgGlobal>({ source: `${CG} /global`, url: `${BASE}/global`, headers: headers(), ttlSeconds: 15 * 60 });
}

// Real API responses can omit any section (e.g. developer_data for coins without a repo),
// so every field is treated as possibly missing.
type DeepPartial<T> = T extends (infer U)[] ? DeepPartial<U>[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type CgCoin = DeepPartial<CgCoinFull>;
type CgCoinFull = {
  id: string; symbol: string; name: string; categories: string[]; description: { en: string };
  links: { homepage: string[]; blockchain_site: string[]; twitter_screen_name: string | null; subreddit_url: string | null; repos_url: { github: string[] } };
  genesis_date: string | null; asset_platform_id: string | null; platforms: Record<string, string>;
  image: { large: string; small: string };
  sentiment_votes_up_percentage: number | null; watchlist_portfolio_users: number | null;
  market_data: { current_price: { usd: number }; market_cap: { usd: number }; fully_diluted_valuation: { usd?: number }; total_volume: { usd: number }; circulating_supply: number | null; total_supply: number | null; max_supply: number | null; price_change_percentage_7d: number | null; price_change_percentage_30d: number | null; price_change_percentage_60d: number | null; price_change_percentage_200d: number | null; ath: { usd: number }; ath_change_percentage: { usd: number }; last_updated: string };
  community_data: { twitter_followers: number | null; reddit_subscribers: number | null; telegram_channel_user_count: number | null };
  developer_data: { forks: number | null; stars: number | null; subscribers: number | null; total_issues: number | null; closed_issues: number | null; pull_requests_merged: number | null; pull_request_contributors: number | null; commit_count_4_weeks: number | null; code_additions_deletions_4_weeks: { additions: number | null; deletions: number | null }; last_4_weeks_commit_activity_series: number[] };
  tickers: { market: { name: string; identifier: string }; target: string; converted_volume: { usd: number }; trust_score: string | null; is_anomaly: boolean; is_stale: boolean }[];
  last_updated: string;
};
export async function coin(id: string) {
  return getJson<CgCoin>({
    source: `${CG} /coins/{id}`,
    url: `${BASE}/coins/${encodeURIComponent(id)}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false`,
    headers: headers(), ttlSeconds: 6 * 3600,
  });
}

export type CgChart = { prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] };
/** Daily history. Free/Demo plans are limited to the last 365 days, which is all the analysis needs. */
export async function marketChart(id: string, days = 365) {
  return getJson<CgChart>({
    source: `${CG} /coins/{id}/market_chart`,
    url: `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    headers: headers(), ttlSeconds: 6 * 3600,
  });
}

export type CgRates = { rates: Record<string, { value: number; unit: string }> };
export async function exchangeRates() {
  return getJson<CgRates>({ source: `${CG} /exchange_rates`, url: `${BASE}/exchange_rates`, headers: headers(), ttlSeconds: 3600 });
}
