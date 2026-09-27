import { NextResponse } from 'next/server';
import { analyzeSingle } from '@/lib/scan';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const ok = await analyzeSingle(params.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Run a scan first; this coin must be in the scanned universe.' }, { status: 400 });
}
