import Link from 'next/link';
import { latestScan, dailyFive, currentFx } from '@/lib/data';
import type { MarketOverview } from '@/lib/scan';
import { money, price, pct, when, num } from '@/lib/format';
import { Panel, Stat, Change, Disclaimer, Empty, cn } from '@/components/ui';
import { CandidateCard } from '@/components/CoinBlocks';
import { ScanButton } from '@/components/ScanButton';
import { getSettings } from '@/lib/scan';

export const metadata = { title: 'Dashboard' };

const REGIME_TONE: Record<string, string> = { BULLISH: 'text-up border-up/40', BEARISH: 'text-down border-down/40', NEUTRAL: 'text-txt-soft border-term-line2', 'HIGH VOLATILITY': 'text-warn border-warn/40' };

export default async function Dashboard() {
  const scan = await latestScan();
  const fx = await currentFx();
  const settings = await getSettings();
  if (!scan) {
    return (
      <>
        <Title />
        <Panel><Empty title="No scan yet">Run today’s scan to collect market data, check the market regime and build your first 5 research candidates. A full scan takes about 3–5 minutes on the free CoinGecko plan.<div className="mt-6"><ScanButton big /></div></Empty></Panel>
      </>
    );
  }
  const mk = scan.market as unknown as MarketOverview;
  const five = await dailyFive(scan.id);
  return (
    <>
      <Title date={scan.scanDate} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="BTC" metric={mk.btc.price} value={price(mk.btc.price.value, fx)} sub={<>7D <Change v={mk.btc.change7d.value} /></>} />
        <Stat label="ETH" metric={mk.eth.price} value={price(mk.eth.price.value, fx)} sub={<>7D <Change v={mk.eth.change7d.value} /></>} />
        <Stat label="Total market cap" metric={mk.totalMarketCap} value={money(mk.totalMarketCap.value, fx)} sub={<>24H <Change v={mk.totalMcapChange24h.value} /></>} />
        <Stat label="BTC dominance" metric={mk.btcDominance} value={`${num(mk.btcDominance.value, 1)}%`} sub={<>ETH {num(mk.ethDominance.value, 1)}%</>} />
        <Stat label="Fear & Greed" metric={mk.fearGreed} value={num(mk.fearGreed.value)} sub={mk.fearGreed.label ?? 'N/A'} />
      </div>

      <div className="mt-3 panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-mute">Market regime</span>
        <span className={cn('rounded border px-2 py-0.5 font-mono text-sm font-bold tracking-wider', REGIME_TONE[mk.regime])}>{mk.regime}</span>
        <span className="text-xs text-txt-soft">Confidence {mk.regimeConfidence.toLowerCase()} · score {mk.regimeScore > 0 ? '+' : ''}{mk.regimeScore} from {mk.evidence.length} signals · altcoins 7D {pct(mk.alt7d.value)} · breadth {num(mk.breadth7d.value)}% up</span>
        <Link href="/market" className="ml-auto text-xs font-semibold text-amber hover:underline">See the evidence →</Link>
      </div>

      <section className="mt-6" aria-labelledby="five">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="five" className="text-sm font-bold uppercase tracking-[0.16em] text-txt">Today’s 5 research candidates</h2>
            <p className="text-xs text-txt-mute">Scanned {num(scan.universeCount)} coins · {num(scan.eligibleCount)} passed your filters ({settings.priceFilter.replace(/_/g, ' ').toLowerCase()}, {settings.riskPreference.toLowerCase()} risk, min volume {money(settings.minVolumeUsd)}) · {scan.analyzedCount} analysed in depth · finished {when(scan.finishedAt)}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/daily" className="btn-ghost btn-sm">Full Daily 5 &amp; comparison</Link>
            <Link href={`/report/${scan.id}`} className="btn-ghost btn-sm">Daily report</Link>
          </div>
        </div>
        {five.length === 0 ? <Panel><Empty title="No coin met every requirement today">Try widening the price filter or risk preference in Settings. Coins with serious red flags are never selected.</Empty></Panel> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {five.map((c) => <CandidateCard key={c.id} rank={c.rank!} id={c.coinId} name={c.name} symbol={c.symbol} image={c.image} a={c.a} fx={fx} />)}
          </div>
        )}
        {five.length > 0 && five.length < 5 && <p className="mt-2 text-xs text-warn">{scan.progress}</p>}
      </section>

      {scan.errors.length > 0 && (
        <details className="mt-6 panel px-4 py-3 text-sm">
          <summary className="cursor-pointer text-warn">{scan.errors.length} data source issue{scan.errors.length === 1 ? '' : 's'} during this scan (affected values show N/A)</summary>
          <ul className="mt-2 space-y-1 text-xs text-txt-soft">{scan.errors.slice(0, 30).map((e, i) => <li key={i}>{e.source}: {e.message}</li>)}</ul>
        </details>
      )}
      <Disclaimer className="mt-8" />
    </>
  );
}

function Title({ date }: { date?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-[0.25em] text-amber">CRYPTO 5</h1>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-txt-soft">Daily opportunity scanner{date ? ` · ${date}` : ''}</p>
      </div>
      <p className="max-w-md text-right text-[11px] leading-snug text-txt-mute">Research screening, not advice. Scores rank available evidence; they do not predict prices.</p>
    </div>
  );
}
