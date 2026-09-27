import { desc, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { currentFx } from '@/lib/data';
import type { Analysis } from '@/lib/scan';
import { money, price, when, day } from '@/lib/format';
import { Panel, Change, Risk, CoinName, Empty } from '@/components/ui';
import { ActionForm, CoinPicker } from '@/components/Forms';
import { createAlert } from '@/app/actions/user';
import { coinOptions } from '@/lib/coins';
import { AlertRowButtons, RemoveWatch, MarkRead } from './WatchButtons';

export const metadata = { title: 'Watchlist' };

const TYPES: [string, string, string][] = [
  ['PRICE', 'Price (USD)', 'e.g. 0.05'], ['VOLUME_CHANGE', 'Volume change vs previous scan (%)', 'e.g. 30'], ['MARKET_CAP', 'Market cap (USD)', 'e.g. 500000000'],
  ['RSI', 'RSI(14)', 'e.g. 70'], ['TVL_CHANGE', 'TVL 7-day change (%)', 'e.g. -20'], ['DEV_CHANGE', 'Developer activity change (%)', 'e.g. -50'], ['UNLOCK', 'Days until a recorded token unlock', 'e.g. 14'],
];

export default async function WatchlistPage() {
  const fx = await currentFx();
  const list = await db.select().from(schema.watchlist).orderBy(desc(schema.watchlist.addedAt));
  const ids = list.map((w) => w.coinId);
  const uni = ids.length ? await db.select().from(schema.universe).where(inArray(schema.universe.coinId, ids)) : [];
  const an = ids.length ? await db.execute<{ coin_id: string; score: number; risk_level: string; analysis: Analysis }>(sql`select distinct on (coin_id) coin_id, score, risk_level, analysis from scan_coins where coin_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) order by coin_id, id desc`) : { rows: [] };
  const byA = new Map(an.rows.map((r) => [r.coin_id, r]));
  const byU = new Map(uni.map((u) => [u.coinId, u]));
  const alerts = await db.select().from(schema.alerts).orderBy(desc(schema.alerts.createdAt));
  const events = await db.select().from(schema.alertEvents).orderBy(desc(schema.alertEvents.createdAt)).limit(30);
  const coins = await coinOptions();
  const typeLabel = Object.fromEntries(TYPES.map(([k, l]) => [k, l]));

  return (
    <>
      <h1 className="mb-4 text-sm font-bold uppercase tracking-[0.16em]">My watchlist</h1>
      <Panel title={`${list.length} tracked coins`} action={<span className="text-[10px] normal-case tracking-normal text-txt-mute">Watchlist coins are re-analysed on every scan</span>}>
        {list.length === 0 ? <Empty title="Nothing tracked yet">Use “Add to watchlist” on any coin page or Daily 5 card.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Coin</th><th className="text-right">Price</th><th className="text-right">Market cap</th><th className="text-right">7D</th><th className="text-right">30D</th><th className="text-right">Score</th><th>Risk</th><th>Next catalyst</th><th>Next unlock</th><th>Last analysis</th><th /></tr></thead>
              <tbody>
                {list.map((w) => {
                  const u = byU.get(w.coinId), x = byA.get(w.coinId);
                  const cats = x?.analysis.catalysts ?? [];
                  const today = new Date().toISOString().slice(0, 10);
                  const nextCat = cats.filter((c) => c.kind !== 'UNLOCK' && c.date && c.date >= today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
                  const nextUnlock = cats.filter((c) => c.kind === 'UNLOCK' && c.date && c.date >= today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
                  return (
                    <tr key={w.coinId}>
                      <td><CoinName id={w.coinId} name={w.name} symbol={w.symbol} image={w.image} /></td>
                      <td className="num text-right">{price(u?.priceUsd, fx)}</td>
                      <td className="num text-right">{money(u?.marketCap, fx)}</td>
                      <td className="text-right"><Change v={u?.change7d} /></td>
                      <td className="text-right"><Change v={u?.change30d} /></td>
                      <td className="num text-right font-semibold text-amber">{x?.score ?? '—'}</td>
                      <td>{x ? <Risk level={x.risk_level} /> : <span className="text-xs text-txt-mute">N/A</span>}</td>
                      <td className="max-w-48 truncate text-xs text-txt-soft">{nextCat ? `${day(nextCat.date)} · ${nextCat.event}` : 'None recorded'}</td>
                      <td className="text-xs text-txt-soft">{nextUnlock ? day(nextUnlock.date) : 'None recorded'}</td>
                      <td className="text-xs text-txt-mute">{x ? when(x.analysis.analyzedAt) : 'Not yet'}</td>
                      <td><RemoveWatch coin={{ coinId: w.coinId, symbol: w.symbol, name: w.name, image: w.image }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title="Create an alert">
          <div className="p-4">
            <ActionForm action={createAlert} submit="Create alert">
              <div><label htmlFor="al-coin" className="label">Coin</label><CoinPicker coins={coins} id="al-coin" /></div>
              <div><label htmlFor="al-type" className="label">Alert when</label><select id="al-type" name="type" className="input">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label htmlFor="al-op" className="label">Is</label><select id="al-op" name="operator" className="input"><option value="ABOVE">Above</option><option value="BELOW">Below</option></select></div>
                <div><label htmlFor="al-th" className="label">Value</label><input id="al-th" name="threshold" className="input" inputMode="decimal" required placeholder="30" /></div>
              </div>
              <p className="text-[11px] text-txt-mute">Example: “Volume change above 30” = alert me if volume is 30%+ higher than at the previous scan. Alerts are checked after each scan. Whale movements, partnerships and security incidents need paid data feeds and are not available as automatic alerts; record them under Settings → Catalysts.</p>
            </ActionForm>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Active alerts">
            {alerts.length === 0 ? <Empty title="No alerts yet" /> : (
              <table className="tbl"><tbody>{alerts.map((a) => <tr key={a.id} className={a.active ? '' : 'opacity-50'}><td className="num font-semibold uppercase">{a.symbol}</td><td className="text-txt-soft">{typeLabel[a.type]} {a.operator === 'ABOVE' ? '>' : '<'} <span className="num">{a.threshold.toLocaleString('en-US')}</span></td><td className="text-xs text-txt-mute">{a.lastTriggeredAt ? `Last triggered ${when(a.lastTriggeredAt)}` : 'Not triggered yet'}</td><td className="text-right"><AlertRowButtons id={a.id} active={a.active} /></td></tr>)}</tbody></table>
            )}
          </Panel>
          <Panel title="Triggered alerts" action={events.some((e) => !e.read) ? <MarkRead /> : undefined}>
            {events.length === 0 ? <Empty title="Nothing triggered yet" /> : <ul className="divide-y divide-term-line/60 text-sm">{events.map((e) => <li key={e.id} className="flex gap-3 px-4 py-2"><span className={e.read ? 'text-txt-mute' : 'text-amber'}>●</span><span className="flex-1 text-txt-soft">{e.message}</span><span className="text-xs text-txt-mute">{when(e.createdAt)}</span></li>)}</ul>}
          </Panel>
        </div>
      </div>
    </>
  );
}
