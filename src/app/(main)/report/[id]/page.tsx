import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { dailyFive, currentFx } from '@/lib/data';
import type { MarketOverview } from '@/lib/scan';
import { money, price, pct, num, day, when } from '@/lib/format';
import { Bullets, Disclaimer } from '@/components/ui';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Daily research report' };

export default async function ReportPage({ params }: { params: { id: string } }) {
  const scan = await db.query.scans.findFirst({ where: eq(schema.scans.id, Number(params.id)) });
  if (!scan || scan.status !== 'DONE') notFound();
  const mk = scan.market as unknown as MarketOverview;
  const five = await dailyFive(scan.id);
  const fx = await currentFx();
  const risks: string[] = [];
  if (mk.regime === 'BEARISH') risks.push('Market regime is bearish: most signals point down, and altcoins usually fall harder than BTC.');
  if (mk.regime === 'HIGH VOLATILITY') risks.push(`BTC volatility is elevated (${num(mk.btc.tech?.volatility30d ?? null)}% annualised); sharp moves in both directions are likely.`);
  if ((mk.fearGreed.value ?? 50) >= 75) risks.push(`Fear & Greed at ${mk.fearGreed.value} (extreme greed): sentiment is stretched.`);
  if ((mk.fearGreed.value ?? 50) <= 25) risks.push(`Fear & Greed at ${mk.fearGreed.value} (extreme fear): liquidity can dry up quickly.`);
  if ((mk.btcDominance.value ?? 0) > 55) risks.push(`BTC dominance is high (${num(mk.btcDominance.value, 1)}%): capital is concentrated in BTC rather than altcoins.`);
  if ((mk.breadth7d.value ?? 50) < 40) risks.push(`Weak breadth: only ${num(mk.breadth7d.value)}% of top-100 altcoins rose this week.`);
  risks.push('Low-priced and small-cap coins can fall 50–90% even in good markets.', 'Holder concentration, unlock schedules and exchange flows are only partly measured with free data.');
  const change = [
    `BTC closing below its 200-day EMA (${price(mk.btc.tech?.ema200 ?? null, fx)}).`,
    `Fear & Greed moving ${(mk.fearGreed.value ?? 50) >= 50 ? 'below 40' : 'above 60'}.`,
    'A sharp fall in stablecoin market cap (money leaving crypto).',
    'Any candidate triggering its invalidation conditions (listed for each coin).',
    'New unlocks, security incidents or delistings announced for a candidate.',
  ];
  return (
    <article className="mx-auto max-w-4xl space-y-6 text-sm leading-relaxed">
      <div className="no-print flex justify-end"><PrintButton /></div>
      <header className="border-b border-term-line pb-4">
        <p className="font-mono text-lg font-bold tracking-[0.2em] text-amber">CRYPTO 5 — DAILY RESEARCH REPORT</p>
        <p className="mt-1 text-txt-soft">Date: {day(scan.scanDate)} · generated {when(scan.finishedAt)} · data: {scan.dataMode === 'SAMPLE' ? 'SAMPLE (fictional, testing only)' : 'live APIs'}</p>
      </header>
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-txt-mute">Market regime</h2>
        <p><span className="font-mono font-bold text-amber">{mk.regime}</span> ({mk.regimeConfidence.toLowerCase()} confidence; net signal {mk.regimeScore > 0 ? '+' : ''}{mk.regimeScore}). {mk.evidence.filter((e) => e.value !== 'N/A').map((e) => `${e.signal}: ${e.value}`).join(' · ')}.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-3">
          <li><span className="text-txt-mute">BTC:</span> <span className="num">{price(mk.btc.price.value, fx)}</span> ({pct(mk.btc.change7d.value)} 7D)</li>
          <li><span className="text-txt-mute">ETH:</span> <span className="num">{price(mk.eth.price.value, fx)}</span> ({pct(mk.eth.change7d.value)} 7D)</li>
          <li><span className="text-txt-mute">Total market:</span> <span className="num">{money(mk.totalMarketCap.value, fx)}</span> ({pct(mk.totalMcapChange24h.value)} 24H)</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-txt-mute">Today’s 5 candidates</h2>
        {five.length === 0 && <p className="text-txt-mute">No coin met every requirement.</p>}
        <ol className="space-y-5">
          {five.map((c) => (
            <li key={c.id} className="rounded-md border border-term-line p-4">
              <h3 className="text-base font-semibold">{c.rank}. {c.name} ({c.symbol.toUpperCase()}) — research score {c.score}/100 · {c.riskLevel.toLowerCase()}</h3>
              <p className="text-xs text-txt-mute">{price(c.priceUsd, fx)} · MC {money(c.marketCap, fx)} · FDV {money(c.fdv, fx)} · Vol {money(c.volume24h, fx)} · 7D {pct(c.change7d)} · 30D {pct(c.change30d)}</p>
              <dl className="mt-3 space-y-2">
                <div><dt className="font-semibold">Fundamental thesis</dt><dd className="text-txt-soft">{c.a.narrative.fundamentalThesis}</dd></div>
                <div><dt className="font-semibold">Technical setup</dt><dd className="text-txt-soft">{c.a.narrative.technicalSetup}</dd></div>
                <div><dt className="font-semibold">Catalysts</dt><dd className="text-txt-soft">{c.a.catalysts.length ? c.a.catalysts.map((k) => `${k.date ?? 'N/A'}: ${k.event}`).join('; ') : 'None recorded.'}</dd></div>
                <div><dt className="font-semibold">Risks</dt><dd><Bullets items={[...c.a.score.flags.map((f) => f.text), ...c.a.narrative.whyNot.slice(0, 3)]} tone="down" /></dd></div>
                <div><dt className="font-semibold">Score</dt><dd className="text-txt-soft">{c.a.score.components.map((x) => `${x.label} ${x.points}/${x.max}`).join(' · ')}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>
      <section><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-txt-mute">Market risks today</h2><Bullets items={risks} tone="down" /></section>
      <section><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-txt-mute">What would change our view?</h2><Bullets items={change} tone="warn" /></section>
      <Disclaimer />
    </article>
  );
}
