import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { currentFx } from '@/lib/data';
import { money, price, pct, compact } from '@/lib/format';
import { Panel, CoinName, Empty, cn } from '@/components/ui';
import { ActionForm, CoinPicker } from '@/components/Forms';
import { addHolding } from '@/app/actions/user';
import { coinOptions } from '@/lib/coins';
import { DeleteHolding } from './DeleteHolding';

export const metadata = { title: 'Portfolio' };

export default async function PortfolioPage() {
  const fx = await currentFx();
  const hs = await db.select().from(schema.holdings).orderBy(desc(schema.holdings.createdAt));
  const uni = hs.length ? await db.select().from(schema.universe).where(inArray(schema.universe.coinId, hs.map((h) => h.coinId))) : [];
  const px = new Map(uni.map((u) => [u.coinId, u.priceUsd]));
  const rows = hs.map((h) => {
    const invested = h.quantity * h.avgEntryUsd;
    const cur = px.get(h.coinId);
    const value = cur != null ? h.quantity * cur : null;
    return { ...h, invested, value, pl: value !== null ? value - invested : null, plPct: value !== null ? ((value - invested) / invested) * 100 : null };
  });
  const totInv = rows.reduce((s, r) => s + r.invested, 0);
  const totVal = rows.every((r) => r.value !== null) ? rows.reduce((s, r) => s + (r.value ?? 0), 0) : null;
  const coins = await coinOptions();
  return (
    <>
      <h1 className="mb-2 text-sm font-bold uppercase tracking-[0.16em]">Portfolio <span className="font-normal normal-case tracking-normal text-txt-mute">· manual entries, no trading</span></h1>
      <p role="note" className="mb-4 rounded-md border border-down/40 bg-down/10 px-4 py-2.5 text-sm text-txt">Crypto assets are highly volatile and can lose substantial or all of their value.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Amount invested', money(totInv, fx)], ['Current value', money(totVal, fx)], ['Profit / loss', totVal !== null ? money(totVal - totInv, fx) : 'N/A'], ['Change', totVal !== null && totInv ? pct(((totVal - totInv) / totInv) * 100) : 'N/A']].map(([l, v]) => (
          <div key={l} className="panel px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-mute">{l}</p><p className={cn('num mt-1 text-xl font-semibold', l !== 'Amount invested' && l !== 'Current value' && totVal !== null ? (totVal >= totInv ? 'text-up' : 'text-down') : '')}>{v}</p></div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title="Holdings">
          {rows.length === 0 ? <Empty title="No holdings entered" /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Coin</th><th className="text-right">Quantity</th><th className="text-right">Avg entry</th><th className="text-right">Current</th><th className="text-right">Invested</th><th className="text-right">Value</th><th className="text-right">P/L</th><th className="text-right">%</th><th>Allocation</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const alloc = totVal ? ((r.value ?? 0) / totVal) * 100 : null;
                    return (
                      <tr key={r.id}>
                        <td><CoinName id={r.coinId} name={r.name} symbol={r.symbol} image={r.image} /></td>
                        <td className="num text-right">{compact(r.quantity)}</td>
                        <td className="num text-right">{price(r.avgEntryUsd, fx)}</td>
                        <td className="num text-right">{price(px.get(r.coinId), fx)}</td>
                        <td className="num text-right">{money(r.invested, fx)}</td>
                        <td className="num text-right">{money(r.value, fx)}</td>
                        <td className={cn('num text-right', (r.pl ?? 0) >= 0 ? 'text-up' : 'text-down')}>{money(r.pl, fx)}</td>
                        <td className={cn('num text-right', (r.plPct ?? 0) >= 0 ? 'text-up' : 'text-down')}>{pct(r.plPct)}</td>
                        <td className="w-40">{alloc !== null && <span className="flex items-center gap-2"><span className="h-1.5 flex-1 rounded-full bg-term-raised"><span className="block h-full rounded-full bg-s1" style={{ width: `${alloc}%` }} /></span><span className="num w-10 text-right text-xs">{alloc.toFixed(0)}%</span></span>}</td>
                        <td><DeleteHolding id={r.id} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-[11px] text-txt-mute">Current prices come from the latest scan (CoinGecko). Entries are in USD.</p>
        </Panel>
        <Panel title="Add a holding">
          <div className="p-4">
            <ActionForm action={addHolding} submit="Add holding">
              <div><label htmlFor="h-coin" className="label">Coin</label><CoinPicker coins={coins} id="h-coin" /></div>
              <div><label htmlFor="h-q" className="label">Quantity</label><input id="h-q" name="quantity" className="input" inputMode="decimal" required /></div>
              <div><label htmlFor="h-e" className="label">Average entry price (USD)</label><input id="h-e" name="avgEntryUsd" className="input" inputMode="decimal" required /></div>
              <div><label htmlFor="h-n" className="label">Note</label><input id="h-n" name="note" className="input" /></div>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
