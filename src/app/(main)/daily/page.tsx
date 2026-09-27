import Link from 'next/link';
import { latestScan, dailyFive, currentFx } from '@/lib/data';
import { money, price, day } from '@/lib/format';
import { Panel, Empty, Bullets, Risk, ScorePill, CoinLogo, Change, Disclaimer, M } from '@/components/ui';
import { ScoreBreakdown, FlagList } from '@/components/CoinBlocks';
import { CompareTable } from '@/components/CompareTable';
import { WatchButton } from '@/components/WatchButton';
import { db, schema } from '@/db';

export const metadata = { title: 'Daily 5' };

export default async function DailyPage() {
  const scan = await latestScan();
  const fx = await currentFx();
  if (!scan) return <Panel><Empty title="No scan yet">Run today’s scan first.</Empty></Panel>;
  const five = await dailyFive(scan.id);
  const watched = new Set((await db.select({ id: schema.watchlist.coinId }).from(schema.watchlist)).map((w) => w.id));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-[0.16em]">5 daily research candidates</h1>
          <p className="text-xs text-txt-mute">{day(scan.scanDate)} · selection rules: passes your filters, no serious red flags, within your risk preference, ≥50% data coverage, at most 2 per sector, highest research score.</p>
        </div>
        <Link href={`/report/${scan.id}`} className="btn-ghost btn-sm">Open daily report</Link>
      </div>
      {five.length === 0 ? <Panel><Empty title="No candidates today">No coin met every requirement. Widen your filters in Settings.</Empty></Panel> : (
        <>
          <Panel title="Comparison"><CompareTable rows={five} fx={fx} /></Panel>
          <div className="mt-6 space-y-6">
            {five.map((c) => {
              const a = c.a, n = a.narrative;
              return (
                <article key={c.id} id={c.coinId} className="panel scroll-mt-20">
                  <header className="flex flex-wrap items-center gap-4 border-b border-term-line px-4 py-3">
                    <span className="num text-lg font-bold text-amber">#{c.rank}</span>
                    <CoinLogo src={c.image} symbol={c.symbol} size={36} />
                    <div className="mr-auto"><h2 className="text-lg font-semibold">{c.name} <span className="num text-sm uppercase text-txt-mute">{c.symbol}</span></h2><Risk level={a.score.risk} /></div>
                    <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs sm:grid-cols-6">
                      {[['Price', <M key="p" metric={a.metrics.price}>{price(c.priceUsd, fx)}</M>], ['Market cap', <M key="m" metric={a.metrics.marketCap}>{money(c.marketCap, fx)}</M>], ['FDV', <M key="f" metric={a.metrics.fdv}>{money(c.fdv, fx)}</M>], ['24H volume', <M key="v" metric={a.metrics.volume24h}>{money(c.volume24h, fx)}</M>], ['7D', <Change key="7" v={c.change7d} />], ['30D / 90D', <span key="3"><Change v={c.change30d} /> <Change v={c.change90d} /></span>]].map(([k, v]) => <div key={k as string}><dt className="text-[10px] uppercase tracking-wider text-txt-mute">{k}</dt><dd className="num">{v}</dd></div>)}
                    </dl>
                    <ScorePill score={a.score.total} size="lg" />
                  </header>
                  <div className="grid gap-6 p-4 lg:grid-cols-3">
                    <div className="space-y-5">
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-up">Why it qualified</h3><Bullets items={n.whyQualified} tone="up" /></section>
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Bull case — what would need to happen</h3><Bullets items={n.bullCase} /></section>
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Bear case — what could go wrong</h3><Bullets items={n.bearCase} tone="down" /></section>
                    </div>
                    <div className="space-y-5">
                      <section className="rounded-md border border-down/40 bg-down/5 p-3"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-down">Why you should not buy this coin</h3><Bullets items={n.whyNot} tone="down" /></section>
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-warn">Red flags</h3><FlagList a={a} /></section>
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Invalidation conditions</h3><Bullets items={n.invalidation} tone="warn" /></section>
                    </div>
                    <div className="space-y-5">
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Score breakdown</h3><ScoreBreakdown a={a} compact /></section>
                      <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Catalysts</h3>
                        {a.catalysts.length ? <Bullets items={a.catalysts.map((k) => `${k.date ?? 'Date N/A'} · ${k.event}${k.significance ? ` — ${k.significance}` : ''}${k.risk ? ` (risk: ${k.risk})` : ''}`)} /> : <p className="text-sm text-txt-mute">None recorded. Add verified events from official sources in <Link href="/settings#catalysts" className="text-amber hover:underline">Settings → Catalysts</Link>.</p>}
                      </section>
                      {n.lowPriceNote && <p className="rounded-md bg-term-raised p-3 text-xs leading-relaxed text-txt-soft">{n.lowPriceNote}</p>}
                      <div className="flex flex-wrap gap-2"><Link href={`/coin/${c.coinId}`} className="btn-amber btn-sm">View full analysis</Link><WatchButton coin={{ coinId: c.coinId, symbol: c.symbol, name: c.name, image: c.image }} watched={watched.has(c.coinId)} /></div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      <Disclaimer className="mt-8" />
    </>
  );
}
