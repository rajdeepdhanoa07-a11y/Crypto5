// Crypto 5 database schema (PostgreSQL, Drizzle ORM)
import { pgTable, text, timestamp, boolean, integer, jsonb, doublePrecision, serial, date, index, uniqueIndex } from 'drizzle-orm/pg-core';

const now = (n: string) => timestamp(n, { withTimezone: true }).notNull().defaultNow();

/** Raw API responses, cached to respect free-tier rate limits. */
export const apiCache = pgTable('api_cache', {
  key: text('key').primaryKey(),
  source: text('source').notNull(),
  body: jsonb('body').notNull(),
  fetchedAt: now('fetched_at'),
});

export const scans = pgTable('scans', {
  id: serial('id').primaryKey(),
  scanDate: date('scan_date').notNull(),
  trigger: text('trigger').notNull(), // MANUAL | AUTO
  status: text('status').notNull(), // RUNNING | DONE | FAILED
  progress: text('progress'),
  dataMode: text('data_mode').notNull(), // LIVE | SAMPLE
  startedAt: now('started_at'),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  market: jsonb('market').$type<Record<string, unknown>>(), // market overview + regime with evidence
  universeCount: integer('universe_count').notNull().default(0),
  eligibleCount: integer('eligible_count').notNull().default(0),
  analyzedCount: integer('analyzed_count').notNull().default(0),
  errors: jsonb('errors').$type<{ source: string; message: string }[]>().notNull().default([]),
}, (t) => [index('scans_date_idx').on(t.scanDate)]);

/** One row per deeply analysed coin per scan; selected=true for the Daily 5. */
export const scanCoins = pgTable('scan_coins', {
  id: serial('id').primaryKey(),
  scanId: integer('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  selected: boolean('selected').notNull().default(false),
  rank: integer('rank'), // 1..5 when selected
  priceUsd: doublePrecision('price_usd'),
  marketCap: doublePrecision('market_cap'),
  fdv: doublePrecision('fdv'),
  volume24h: doublePrecision('volume_24h'),
  change7d: doublePrecision('change_7d'),
  change30d: doublePrecision('change_30d'),
  change90d: doublePrecision('change_90d'),
  score: integer('score').notNull(),
  riskLevel: text('risk_level').notNull(),
  excluded: boolean('excluded').notNull().default(false),
  reason: text('reason'),
  analysis: jsonb('analysis').$type<Record<string, unknown>>().notNull(),
}, (t) => [index('scan_coins_scan_idx').on(t.scanId), index('scan_coins_coin_idx').on(t.coinId)]);

/** Light price snapshot of the whole scanned universe, used for 7/30/90-day reviews. */
export const priceSnapshots = pgTable('price_snapshots', {
  id: serial('id').primaryKey(),
  snapDate: date('snap_date').notNull(),
  coinId: text('coin_id').notNull(),
  priceUsd: doublePrecision('price_usd'),
  marketCap: doublePrecision('market_cap'),
  volume24h: doublePrecision('volume_24h'),
}, (t) => [uniqueIndex('snap_unique').on(t.snapDate, t.coinId), index('snap_coin_idx').on(t.coinId, t.snapDate)]);

export type ScreenFilters = Record<string, string | number | null>;

export const savedScreens = pgTable('saved_screens', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  filters: jsonb('filters').$type<ScreenFilters>().notNull(),
  createdAt: now('created_at'),
});

export const watchlist = pgTable('watchlist', {
  coinId: text('coin_id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  note: text('note'),
  addedAt: now('added_at'),
});

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  type: text('type').notNull(), // PRICE | VOLUME_CHANGE | MARKET_CAP | RSI | TVL_CHANGE | DEV_CHANGE | UNLOCK
  operator: text('operator').notNull(), // ABOVE | BELOW
  threshold: doublePrecision('threshold').notNull(),
  active: boolean('active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: now('created_at'),
});

export const alertEvents = pgTable('alert_events', {
  id: serial('id').primaryKey(),
  alertId: integer('alert_id').references(() => alerts.id, { onDelete: 'cascade' }),
  coinId: text('coin_id').notNull(),
  message: text('message').notNull(),
  value: doublePrecision('value'),
  read: boolean('read').notNull().default(false),
  createdAt: now('created_at'),
});

export const holdings = pgTable('holdings', {
  id: serial('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  quantity: doublePrecision('quantity').notNull(),
  avgEntryUsd: doublePrecision('avg_entry_usd').notNull(),
  note: text('note'),
  createdAt: now('created_at'),
});

/** Catalysts, unlocks and security incidents entered by you from official sources (no reliable free API exists). */
export const catalysts = pgTable('catalysts', {
  id: serial('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  eventDate: date('event_date'),
  kind: text('kind').notNull(), // MAINNET | UPGRADE | BURN | LISTING | ETF | PARTNERSHIP | LAUNCH | GOVERNANCE | INCENTIVES | RELEASE | UNLOCK | SECURITY
  event: text('event').notNull(),
  significance: text('significance'),
  risk: text('risk'),
  unlockPctOfSupply: doublePrecision('unlock_pct_of_supply'),
  resolved: boolean('resolved').notNull().default(false),
  sourceUrl: text('source_url'),
  createdAt: now('created_at'),
});

export type Settings = {
  currency: 'USD' | 'INR';
  priceFilter: 'UNDER_0_01' | '0_01_0_10' | '0_10_1' | 'UNDER_1' | '1_10' | 'OVER_1' | 'OVER_10' | 'ANY';
  riskPreference: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'SPECULATIVE';
  marketCap: 'MICRO' | 'SMALL' | 'MID' | 'LARGE' | 'ANY';
  minVolumeUsd: number;
  universePages: number; // CoinGecko pages of 250 coins
  deepAnalyze: number; // candidates analysed in depth
};

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD', priceFilter: 'UNDER_1', riskPreference: 'BALANCED', marketCap: 'ANY', minVolumeUsd: 1_000_000, universePages: 8, deepAnalyze: 30,
};

export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('default'),
  value: jsonb('value').$type<Settings>().notNull(),
  updatedAt: now('updated_at'),
});

/** Latest market snapshot of every scanned coin (overwritten each scan). Powers the screener. */
export const universe = pgTable('universe', {
  coinId: text('coin_id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  rank: integer('rank'),
  priceUsd: doublePrecision('price_usd'),
  marketCap: doublePrecision('market_cap'),
  fdv: doublePrecision('fdv'),
  volume24h: doublePrecision('volume_24h'),
  change24h: doublePrecision('change_24h'),
  change7d: doublePrecision('change_7d'),
  change30d: doublePrecision('change_30d'),
  change200d: doublePrecision('change_200d'),
  circulating: doublePrecision('circulating'),
  totalSupply: doublePrecision('total_supply'),
  maxSupply: doublePrecision('max_supply'),
  athChangePct: doublePrecision('ath_change_pct'),
  tvl: doublePrecision('tvl'),
  sector: text('sector'),
  chain: text('chain'),
  excludedType: text('excluded_type'), // STABLECOIN | WRAPPED when not researchable
  scanId: integer('scan_id'),
  sourceAt: timestamp('source_at', { withTimezone: true }),
  updatedAt: now('updated_at'),
});
