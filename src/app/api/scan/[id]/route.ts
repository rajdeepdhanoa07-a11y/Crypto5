import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { expireStaleScans } from '@/lib/scan';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await expireStaleScans();
  const s = params.id === 'latest'
    ? await db.query.scans.findFirst({ orderBy: [desc(schema.scans.id)] })
    : await db.query.scans.findFirst({ where: eq(schema.scans.id, Number(params.id)) });
  if (!s) return NextResponse.json({ status: 'NONE' });
  return NextResponse.json({ id: s.id, status: s.status, progress: s.progress, startedAt: s.startedAt, finishedAt: s.finishedAt });
}
