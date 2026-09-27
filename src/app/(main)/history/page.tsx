import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { currentFx } from '@/lib/data';
import { pickReviews, type Review } from '@/lib/reviews';
import { money, price, pct, when, num } from '@/lib/format';
import { Panel, Change, Risk, CoinName, Empty } from '@/components/ui';

export const metadata = { title: 'History' };

function Summary({ rows, k, b, label }: { rows: Review[]; k: 'r7' | 'r30' | 'r90'; b: 'btc7' | 'btc30' | 'btc90'; label: string }) {
  const done = rows.filter((r) => r[k] !== null);
  const avg = done.length ? done.reduce((s, r) => s + r[k]!, 0) / done.length : null;
  const btc = done.filter((r) => r[b] !== null);
  const avgB = btc.length ? btc.reduce((s, r) => s + r[b]!, 0) / btc.length : null;
  const beat = done.filter((r) => r[b] !== null && r[k]! > r[b]!).length;
  return (
    <div className="panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-mute">{label}</p>
      {done.length === 0 ? <p className="mt-1 text-sm text-txt-mute">No picks old enough yet</p> : (
        <>
          <p className="mt-1 text-sm">Average pick <Change v={avg} /> · BTC <Change v={avgB} /></p>
          <p className="text-xs text-txt-soft">{done.length} picks measured · {beat} beat BTC · {done.filter((r) => r[k]! > 0).length} were up</p>
        </>
      )}
    </div>
  );
}

export default async function HistoryPage() {
  const fx = await currentFx();
  const [rows, scans] = await Promise.all([pickReviews(), db.select().from(schema.scans).orderBy(desc(schema.scans.id)).limit(60)]);
  return (
    <>
      <h1 className="mb-2 text-sm font-bold uppercase tracking-[0.16em]">History</h1>
      <p className="mb-4 max-w-3xl text-xs text-txt-mute">What happened after previous research selections. Past results are shown for honest review only; they do not show that the scanner predicts future winners, and a handful of picks is far too small a sample to draw conclusions.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Summary rows={rows} k="r7" b="btc7" label="7-day review" />
        <Summary rows={rows} k="r30" b="btc30" label="30-day review" />
        <Summary rows={rows} k="r90" b="btc90" label="90-day review" />
      </div>
      <Panel className="mt-4" title="Past research candidates">
        {rows.length === 0 ? <Empty title="No picks yet" /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>#</th><th>Coin</th><th className="text-right">Price at scan</th><th className="text-right">Market cap</th><th className="text-right">Score</th><th>Risk</th><th className="text-right">After 7D</th><th className="text-right">After 30D</th><th className="text-right">After 90D</th><th className="text-right">Now</th><th>Reason selected</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.scanId}-${r.coinId}`}>
                    <td className="num"><Link href={`/report/${r.scanId}`} className="hover:text-amber">{r.date}</Link></td>
                    <td className="num text-amber">{r.rank}</td>
                    <td><CoinName id={r.coinId} name={r.name} symbol={r.symbol} image={r.image} /></td>
                    <td className="num text-right">{price(r.priceAt, fx)}</td>
                    <td className="num text-right">{money(r.mcapAt, fx)}</td>
                    <td className="num text-right">{r.score}</td>
                    <td><Risk level={r.risk} /></td>
                    <td className="text-right"><Change v={r.r7} /></td>
                    <td className="text-right"><Change v={r.r30} /></td>
                    <td className="text-right"><Change v={r.r90} /></td>
                    <td className="text-right"><Change v={r.priceAt && r.now ? ((r.now - r.priceAt) / r.priceAt) * 100 : null} /></td>
                    <td className="max-w-80 truncate text-xs text-txt-soft">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel className="mt-4" title="Scan log">
        <table className="tbl">
          <thead><tr><th>#</th><th>Date</th><th>Trigger</th><th>Status</th><th>Data</th><th className="text-right">Universe</th><th className="text-right">Eligible</th><th className="text-right">Analysed</th><th>Regime</th><th>Source issues</th><th>Finished</th></tr></thead>
          <tbody>{scans.map((s) => <tr key={s.id}><td className="num">{s.id}</td><td className="num">{s.scanDate}</td><td className="text-xs">{s.trigger.toLowerCase()}</td><td className={s.status === 'FAILED' ? 'text-down' : s.status === 'RUNNING' ? 'text-amber' : ''}>{s.status.toLowerCase()}</td><td className="text-xs">{s.dataMode.toLowerCase()}</td><td className="num text-right">{num(s.universeCount)}</td><td className="num text-right">{num(s.eligibleCount)}</td><td className="num text-right">{s.analyzedCount}</td><td className="text-xs">{(s.market as { regime?: string } | null)?.regime ?? '—'}</td><td className="num text-xs">{s.errors.length}</td><td className="text-xs text-txt-mute">{when(s.finishedAt)}</td></tr>)}</tbody>
        </table>
      </Panel>
      <p className="mt-3 text-[11px] text-txt-mute">Average moves shown in {pct(0).replace('0.0', '')}% are simple, equal-weight averages of price changes. They ignore fees, slippage and taxes.</p>
    </>
  );
}
