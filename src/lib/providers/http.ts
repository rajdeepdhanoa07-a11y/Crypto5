// Shared HTTP client for all data sources: caching, per-host rate limiting, retries with
// backoff on 429/5xx, and timeouts. API keys come only from environment variables.
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sampleResponse } from './sample';

export class SourceError extends Error {
  constructor(public source: string, message: string, public status?: number) { super(message); }
}

export const DATA_MODE = (process.env.DATA_MODE ?? 'LIVE').toUpperCase() === 'SAMPLE' ? 'SAMPLE' : 'LIVE';

// Minimum spacing between calls per host (free tiers)
const SPACING_MS: Record<string, number> = {
  'api.coingecko.com': 2200, // ~27/min (demo plan allows 30)
  'pro-api.coingecko.com': 150,
  'api.llama.fi': 300,
  'stablecoins.llama.fi': 300,
  'api.github.com': 250,
  'pro-api.coinmarketcap.com': 2100,
  'api.alternative.me': 500,
  'cryptopanic.com': 1000,
};
const lastCall = new Map<string, number>();
async function throttle(host: string) {
  const gap = SPACING_MS[host] ?? 200;
  const wait = (lastCall.get(host) ?? 0) + gap - Date.now();
  lastCall.set(host, Math.max(Date.now(), (lastCall.get(host) ?? 0) + gap));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export type FetchResult<T> = { data: T; fetchedAt: string; cached: boolean };

export async function getJson<T>(opts: { source: string; url: string; headers?: Record<string, string>; ttlSeconds: number; cacheKey?: string }): Promise<FetchResult<T>> {
  const key = opts.cacheKey ?? opts.url.replace(/([?&])(x_cg_[a-z_]+_api_key|auth_token)=[^&]+/g, '$1');
  if (DATA_MODE === 'SAMPLE') {
    const data = sampleResponse(opts.url) as T;
    if (data === undefined) throw new SourceError(opts.source, 'No sample data for this request');
    return { data, fetchedAt: new Date().toISOString(), cached: false };
  }
  const cached = await db.query.apiCache.findFirst({ where: eq(schema.apiCache.key, key) });
  if (cached && Date.now() - cached.fetchedAt.getTime() < opts.ttlSeconds * 1000) {
    return { data: cached.body as T, fetchedAt: cached.fetchedAt.toISOString(), cached: true };
  }
  const host = new URL(opts.url).host;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle(host);
    try {
      const res = await fetch(opts.url, { headers: { accept: 'application/json', ...opts.headers }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        lastErr = new SourceError(opts.source, `HTTP ${res.status}`, res.status);
        await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 2000 * 2 ** attempt)));
        continue;
      }
      if (!res.ok) throw new SourceError(opts.source, `HTTP ${res.status}`, res.status);
      const data = (await res.json()) as T;
      const fetchedAt = new Date();
      await db.insert(schema.apiCache).values({ key, source: opts.source, body: data as object, fetchedAt })
        .onConflictDoUpdate({ target: schema.apiCache.key, set: { body: data as object, fetchedAt } });
      return { data, fetchedAt: fetchedAt.toISOString(), cached: false };
    } catch (e) {
      lastErr = e;
      if (e instanceof SourceError && e.status && e.status < 500 && e.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  // Serve stale cache rather than nothing, and say so
  if (cached) return { data: cached.body as T, fetchedAt: cached.fetchedAt.toISOString(), cached: true };
  throw lastErr instanceof SourceError ? lastErr : new SourceError(opts.source, lastErr instanceof Error ? lastErr.message : 'Request failed');
}
