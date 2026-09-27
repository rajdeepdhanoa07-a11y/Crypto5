import Link from 'next/link';
import { count, eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { DATA_MODE } from '@/lib/providers/http';
import { getSettings } from '@/lib/scan';
import { when } from '@/lib/format';
import { Nav } from '@/components/Nav';
import { ScanButton } from '@/components/ScanButton';

export const dynamic = 'force-dynamic';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [last] = await db.select().from(schema.scans).orderBy(desc(schema.scans.id)).limit(1);
  const [{ n: unread }] = await db.select({ n: count() }).from(schema.alertEvents).where(eq(schema.alertEvents.read, false));
  const s = await getSettings();
  return (
    <div className="min-h-screen">
      {DATA_MODE === 'SAMPLE' && (
        <div className="bg-warn px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-black">Sample data mode — fictional coins for testing only. Set DATA_MODE=LIVE to use real market data.</div>
      )}
      <header className="sticky top-0 z-30 border-b border-term-line bg-term-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0">
          <Link href="/" className="flex shrink-0 items-baseline gap-2">
            <span className="font-mono text-base font-bold tracking-[0.2em] text-amber">CRYPTO 5</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-txt-mute xl:inline">Daily Opportunity Scanner</span>
          </Link>
          <Nav unread={Number(unread)} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden text-right text-[10px] leading-tight text-txt-mute md:block">
              {last ? <>Last scan {last.status === 'DONE' ? when(last.finishedAt) : last.status.toLowerCase()}<br />{s.currency} · {s.priceFilter.replace(/_/g, ' ').replace('UNDER 1', '< $1').toLowerCase()}</> : 'No scan yet'}
            </span>
            <ScanButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6">{children}</main>
    </div>
  );
}
