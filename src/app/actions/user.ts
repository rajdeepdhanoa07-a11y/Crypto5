'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { DEFAULT_SETTINGS, type Settings } from '@/db/schema';

type R = { ok: boolean; error?: string; message?: string } | undefined;

export async function toggleWatch(coin: { coinId: string; symbol: string; name: string; image: string | null }, on: boolean) {
  if (on) await db.insert(schema.watchlist).values(coin).onConflictDoNothing();
  else await db.delete(schema.watchlist).where(eq(schema.watchlist.coinId, coin.coinId));
  revalidatePath('/watchlist');
}

const ALERT_TYPES = ['PRICE', 'VOLUME_CHANGE', 'MARKET_CAP', 'RSI', 'TVL_CHANGE', 'DEV_CHANGE', 'UNLOCK'] as const;
export async function createAlert(_: R, form: FormData): Promise<R> {
  const p = z.object({ coinId: z.string().min(1), type: z.enum(ALERT_TYPES), operator: z.enum(['ABOVE', 'BELOW']), threshold: z.coerce.number().finite() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: 'Choose a coin, alert type and a number.' };
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, p.data.coinId) });
  if (!u) return { ok: false, error: 'That coin is not in the scanned universe yet.' };
  await db.insert(schema.alerts).values({ ...p.data, symbol: u.symbol });
  revalidatePath('/watchlist');
  return { ok: true, message: 'Alert created. It is checked after every scan.' };
}
export async function setAlertActive(id: number, active: boolean) { await db.update(schema.alerts).set({ active }).where(eq(schema.alerts.id, id)); revalidatePath('/watchlist'); }
export async function deleteAlert(id: number) { await db.delete(schema.alerts).where(eq(schema.alerts.id, id)); revalidatePath('/watchlist'); }
export async function markEventsRead() { await db.update(schema.alertEvents).set({ read: true }).where(eq(schema.alertEvents.read, false)); revalidatePath('/', 'layout'); }

export async function addHolding(_: R, form: FormData): Promise<R> {
  const p = z.object({ coinId: z.string().min(1), quantity: z.coerce.number().positive(), avgEntryUsd: z.coerce.number().positive(), note: z.string().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: 'Enter a coin, a quantity and your average entry price in USD.' };
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, p.data.coinId) });
  if (!u) return { ok: false, error: 'That coin is not in the scanned universe yet.' };
  await db.insert(schema.holdings).values({ ...p.data, symbol: u.symbol, name: u.name, image: u.image });
  revalidatePath('/portfolio');
  return { ok: true, message: `${u.name} added.` };
}
export async function deleteHolding(id: number) { await db.delete(schema.holdings).where(eq(schema.holdings.id, id)); revalidatePath('/portfolio'); }

export async function saveScreen(name: string, filters: Record<string, string>) {
  const n = name.trim().slice(0, 60);
  if (!n) return { ok: false, error: 'Name the screen.' };
  await db.insert(schema.savedScreens).values({ name: n, filters });
  revalidatePath('/screener');
  return { ok: true };
}
export async function deleteScreen(id: number) { await db.delete(schema.savedScreens).where(eq(schema.savedScreens.id, id)); revalidatePath('/screener'); }

export async function saveSettings(_: R, form: FormData): Promise<R> {
  const p = z.object({
    currency: z.enum(['USD', 'INR']), priceFilter: z.enum(['UNDER_0_01', '0_01_0_10', '0_10_1', 'UNDER_1', '1_10', 'OVER_1', 'OVER_10', 'ANY']),
    riskPreference: z.enum(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'SPECULATIVE']), marketCap: z.enum(['MICRO', 'SMALL', 'MID', 'LARGE', 'ANY']),
    minVolumeUsd: z.coerce.number().min(0).max(1e10), universePages: z.coerce.number().int().min(1).max(40), deepAnalyze: z.coerce.number().int().min(5).max(100),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: 'Check the settings values.' };
  const value: Settings = { ...DEFAULT_SETTINGS, ...p.data };
  await db.insert(schema.settings).values({ id: 'default', value }).onConflictDoUpdate({ target: schema.settings.id, set: { value, updatedAt: new Date() } });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved. Filters apply to the next scan; currency applies now.' };
}

const KINDS = ['MAINNET', 'UPGRADE', 'BURN', 'LISTING', 'ETF', 'PARTNERSHIP', 'LAUNCH', 'GOVERNANCE', 'INCENTIVES', 'RELEASE', 'UNLOCK', 'SECURITY'] as const;
export async function addCatalyst(_: R, form: FormData): Promise<R> {
  const p = z.object({
    coinId: z.string().min(1), kind: z.enum(KINDS), eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')), event: z.string().trim().min(3).max(200),
    significance: z.string().max(300).optional(), risk: z.string().max(300).optional(), unlockPctOfSupply: z.string().optional(), sourceUrl: z.string().url().optional().or(z.literal('')),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: 'Enter the coin, type, a description and a valid source link.' };
  if (!p.data.sourceUrl) return { ok: false, error: 'Add the official source link so the event can be verified.' };
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, p.data.coinId) });
  if (!u) return { ok: false, error: 'That coin is not in the scanned universe yet.' };
  const pctv = p.data.unlockPctOfSupply ? Number(p.data.unlockPctOfSupply) : null;
  await db.insert(schema.catalysts).values({ ...p.data, eventDate: p.data.eventDate || null, unlockPctOfSupply: Number.isFinite(pctv) ? pctv : null, sourceUrl: p.data.sourceUrl || null });
  revalidatePath('/settings');
  return { ok: true, message: 'Saved. It is used in the next scan or when you re-analyse the coin.' };
}
export async function deleteCatalyst(id: number) { await db.delete(schema.catalysts).where(eq(schema.catalysts.id, id)); revalidatePath('/settings'); }
export async function resolveCatalyst(id: number) { await db.update(schema.catalysts).set({ resolved: true }).where(eq(schema.catalysts.id, id)); revalidatePath('/settings'); }
