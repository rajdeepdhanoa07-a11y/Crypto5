import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSettings, type Analysis, type MarketOverview } from './scan';
import type { Fx } from './format';

export async function latestScan() {
  return db.query.scans.findFirst({ where: eq(schema.scans.status, 'DONE'), orderBy: [desc(schema.scans.id)] });
}

export async function currentFx(): Promise<Fx> {
  const s = await getSettings();
  if (s.currency !== 'INR') return { currency: 'USD', rate: 1 };
  const scan = await latestScan();
  const rate = (scan?.market as unknown as MarketOverview | undefined)?.usdInr?.value;
  return rate ? { currency: 'INR', rate } : { currency: 'USD', rate: 1 };
}

export type CoinRow = typeof schema.scanCoins.$inferSelect & { a: Analysis };

export async function dailyFive(scanId: number): Promise<CoinRow[]> {
  const rows = await db.select().from(schema.scanCoins).where(and(eq(schema.scanCoins.scanId, scanId), eq(schema.scanCoins.selected, true))).orderBy(schema.scanCoins.rank);
  return rows.map((r) => ({ ...r, a: r.analysis as unknown as Analysis }));
}

export async function latestAnalysis(coinId: string): Promise<CoinRow | null> {
  const r = await db.query.scanCoins.findFirst({ where: eq(schema.scanCoins.coinId, coinId), orderBy: [desc(schema.scanCoins.id)] });
  return r ? { ...r, a: r.analysis as unknown as Analysis } : null;
}

export const DISCLAIMER = 'These results are market research generated from available data. They are not guarantees of future performance. Cryptocurrency markets are highly volatile and involve substantial risk.';
