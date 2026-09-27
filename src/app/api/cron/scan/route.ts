import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { startScan, runScan } from '@/lib/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Automatic daily scan. Call with "Authorization: Bearer $CRON_SECRET" (Vercel Cron does this for you). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await startScan('AUTO');
  await runScan(id);
  return NextResponse.json({ id });
}
