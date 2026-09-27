import { NextResponse } from 'next/server';
import { startScan, runScan } from '@/lib/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Starts a scan and keeps working until it finishes. The page polls /api/scan/[id] for progress. */
export async function POST() {
  const id = await startScan('MANUAL');
  await runScan(id);
  return NextResponse.json({ id });
}
