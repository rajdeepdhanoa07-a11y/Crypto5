import Link from 'next/link';
import { and, gte, lte, isNull, sql, desc, asc, eq, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { currentFx } from '@/lib/data';
import type { Analysis } from '@/lib/scan';
import { money, price, num } from '@/lib/format';
import { Panel, Change, Risk, CoinName, Empty } from '@/components/ui';
import { SaveScreen, DeleteScreen } from './ScreenButtons';

export const metadata = { title: 'Screener' };

type SP = Record<string, string | undefined>;
const n = (v?: string) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

const FIELDS: { key: string; label: string; ph: string; deep?: boolean }[] = [
  { key: 'pmin', label: 'Price min ($)', ph: '0' }, { key: 'pmax', label: 'Price max ($)', ph: '1' },
  { key: 'mcmin', label: 'Market cap min ($M)', ph: '50' }, { key: 'mcmax', label: 'Market cap max ($M)', ph: '2000' },
  { key: 'fdvmax', label: 'FDV max ($M)', ph: '' }, { key: 'vmin', label: 'Volume min ($M)', ph: '1' },
  { key: 'liqmin', label: 'Volume/MC min (%)', ph: '2' }, { key: 'c7min', label: '7D min (%)', ph: '' }, { key: 'c7max', label: '7D max (%)', ph: '' },
  { key: 'c30min', label: '30D min (%)', ph: '' }, { key: 'c90min', label: '90D min (%)', ph: '', deep: true },
  { key: 'rsimin', label: 'RSI min', ph: '40', deep: true }, { key: 'rsimax', label: 'RSI max', ph: '70', deep: true },
  { key: 'tvlmin', label: 'TVL min ($M)', ph: '' }, { key: 'devmin', label: 'Commits (4w) min', ph: '10', deep: true },
];

export default async function Screener({ searchParams: sp }: { searchParams: SP }) {
  const fx = await currentFx();
  const u = schema.universe;
  const w: SQL[] = [isNull(u.excludedType)];
  if (n(sp.pmin) !== null) w.push(gte(u.priceUsd, n(sp.pmin)!));
  if (n(sp.pmax) !== null) w.push(lte(u.priceUsd, n(sp.pmax)!));
  if (n(sp.mcmin) !== null) w.push(gte(u.marketCap, n(sp.mcmin)! * 1e6));
  if (n(sp.mcmax) !== null) w.push(lte(u.marketCap, n(sp.mcmax)! * 1e6));
  if (n(sp.fdvmax) !== null) w.push(lte(u.fdv, n(sp.fdvmax)! * 1e6));
  if (n(sp.vmin) !== null) w.push(gte(u.volume24h, n(sp.vmin)! * 1e6));
  if (n(sp.liqmin) !== null) w.push(sql`${u.volume24h} / nullif(${u.marketCap},0) * 100 >= ${n(sp.liqmin)}`);
  if (n(sp.c7min) !== null) w.push(gte(u.change7d, n(sp.c7min)!));
  if (n(sp.c7max) !== null) w.push(lte(u.change7d, n(sp.c7max)!));
  if (n(sp.c30min) !== null) w.push(gte(u.change30d, n(sp.c30min)!));
  if (n(sp.tvlmin) !== null) w.push(gte(u.tvl, n(sp.tvlmin)! * 1e6));
  if (sp.sector) w.push(eq(u.sector, sp.sector));
  if (sp.chain) w.push(eq(u.chain, sp.chain));
  const sort = sp.sort ?? 'mcap';
  const order = sort === 'vol' ? desc(u.volume24h) : sort === '7d' ? desc(u.change7d) : sort === '30d' ? desc(u.change30d) : sort === 'price' ? asc(u.priceUsd) : desc(u.marketCap);
  const rows = await db.select().from(u).where(and(...w)).orderBy(order).limit(1500);
  const ids = rows.map((r) => r.coinId);
  const analyses = ids.length ? await db.execute<{ coin_id: string; score: number; risk_level: string; analysis: Analysis }>(sql`select distinct on (coin_id) coin_id, score, risk_level, analysis from scan_coins where coin_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) order by coin_id, id desc`) : { rows: [] };
  const byId = new Map(analyses.rows.map((r) => [r.coin_id, r]));
  const deepActive = FIELDS.some((f) => f.deep && n(sp[f.key]) !== null) || !!sp.risk || !!sp.unlock;
  const unlockLevel = (a: Analysis) => { const r = a.metrics.fdvRatio.value as number | null; return r === null ? null : r > 3 ? 'HIGH' : r > 1.5 ? 'MEDIUM' : 'LOW'; };
  const out = rows.filter((r) => {
    const x = byId.get(r.coinId);
    if (!deepActive) return true;
    if (!x) return false;
    const a = x.analysis, t = a.facts.tech;
    if (n(sp.c90min) !== null && !((t?.perf90d ?? -Infinity) >= n(sp.c90min)!)) return false;
    if (n(sp.rsimin) !== null && !((t?.rsi14 ?? -1) >= n(sp.rsimin)!)) return false;
    if (n(sp.rsimax) !== null && !((t?.rsi14 ?? 101) <= n(sp.rsimax)!)) return false;
    if (n(sp.devmin) !== null && !((a.facts.commits4w ?? -1) >= n(sp.devmin)!)) return false;
    if (sp.risk && x.risk_level !== sp.risk) return false;
    if (sp.unlock && unlockLevel(a) !== sp.unlock) return false;
    return true;
  }).slice(0, 300);
  const sectors = await db.selectDistinct({ v: u.sector }).from(u).where(sql`${u.sector} is not null`).orderBy(u.sector);
  const chains = await db.selectDistinct({ v: u.chain }).from(u).where(sql`${u.chain} is not null`).orderBy(u.chain);
  const screens = await db.select().from(schema.savedScreens).orderBy(desc(schema.savedScreens.createdAt));
  const current = Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>;

  return (
    <>
      <h1 className="mb-4 text-sm font-bold uppercase tracking-[0.16em]">Screener</h1>
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <form className="panel space-y-3 p-4" method="get">
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((f) => (
                <div key={f.key}><label htmlFor={f.key} className="label">{f.label}{f.deep && <span className="text-amber"> *</span>}</label><input id={f.key} name={f.key} className="input py-1.5" inputMode="decimal" defaultValue={sp[f.key] ?? ''} placeholder={f.ph} /></div>
              ))}
            </div>
            <div><label htmlFor="sector" className="label">Market sector</label><select id="sector" name="sector" className="input py-1.5" defaultValue={sp.sector ?? ''}><option value="">Any</option>{sectors.map((s) => <option key={s.v} value={s.v!}>{s.v}</option>)}</select></div>
            <div><label htmlFor="chain" className="label">Blockchain</label><select id="chain" name="chain" className="input py-1.5" defaultValue={sp.chain ?? ''}><option value="">Any</option>{chains.map((s) => <option key={s.v} value={s.v!}>{s.v}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="unlock" className="label">Unlock risk *</label><select id="unlock" name="unlock" className="input py-1.5" defaultValue={sp.unlock ?? ''}><option value="">Any</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></div>
              <div><label htmlFor="risk" className="label">Risk level *</label><select id="risk" name="risk" className="input py-1.5" defaultValue={sp.risk ?? ''}><option value="">Any</option>{['LOWER RELATIVE RISK', 'MEDIUM RISK', 'HIGH RISK', 'VERY HIGH / SPECULATIVE'].map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select></div>
            </div>
            <div><label htmlFor="sort" className="label">Sort by</label><select id="sort" name="sort" className="input py-1.5" defaultValue={sort}><option value="mcap">Market cap</option><option value="vol">Volume</option><option value="7d">7D change</option><option value="30d">30D change</option><option value="price">Price (low first)</option></select></div>
            <p className="text-[11px] text-txt-mute"><span className="text-amber">*</span> Needs deep analysis: only coins analysed in a scan (or with “Analyse now”) can match. Unlock risk uses FDV ÷ market cap as a proxy unless unlocks are recorded.</p>
            <div className="flex gap-2"><button className="btn-amber btn-sm flex-1">Apply filters</button><Link href="/screener" className="btn-ghost btn-sm">Reset</Link></div>
          </form>
          <div className="panel p-4">
            <p className="label">Saved screens</p>
            <SaveScreen filters={current} />
            <ul className="mt-3 space-y-1 text-sm">
              {screens.length === 0 && <li className="text-txt-mute">None yet.</li>}
              {screens.map((s) => <li key={s.id} className="flex items-center justify-between gap-2"><Link className="truncate hover:text-amber" href={`/screener?${new URLSearchParams(s.filters as Record<string, string>).toString()}`}>{s.name}</Link><DeleteScreen id={s.id} /></li>)}
            </ul>
          </div>
        </aside>
        <Panel title={`${out.length} coins${out.length === 300 ? ' (first 300)' : ''}`} action={<span className="text-[10px] normal-case tracking-normal text-txt-mute">Stablecoins and wrapped tokens excluded · latest scan data</span>}>
          {out.length === 0 ? <Empty title="No coins match">Loosen a filter, or run a scan if you haven’t yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>#</th><th>Coin</th><th className="text-right">Price</th><th className="text-right">Market cap</th><th className="text-right">FDV</th><th className="text-right">Volume</th><th className="text-right">7D</th><th className="text-right">30D</th><th className="text-right">TVL</th><th className="text-right">RSI</th><th className="text-right">Score</th><th>Risk</th></tr></thead>
                <tbody>
                  {out.map((r) => {
                    const x = byId.get(r.coinId);
                    return (
                      <tr key={r.coinId}>
                        <td className="num text-txt-mute">{r.rank ?? ''}</td>
                        <td className="max-w-64"><CoinName id={r.coinId} name={r.name} symbol={r.symbol} image={r.image} /></td>
                        <td className="num text-right">{price(r.priceUsd, fx)}</td>
                        <td className="num text-right">{money(r.marketCap, fx)}</td>
                        <td className="num text-right">{money(r.fdv, fx)}</td>
                        <td className="num text-right">{money(r.volume24h, fx)}</td>
                        <td className="text-right"><Change v={r.change7d} /></td>
                        <td className="text-right"><Change v={r.change30d} /></td>
                        <td className="num text-right">{r.tvl ? money(r.tvl, fx) : <span className="text-txt-mute">—</span>}</td>
                        <td className="num text-right">{x ? num(x.analysis.facts.tech?.rsi14 ?? null, 0) : <span className="text-txt-mute">—</span>}</td>
                        <td className="num text-right font-semibold text-amber">{x ? x.score : <span className="font-normal text-txt-mute">—</span>}</td>
                        <td>{x ? <Risk level={x.risk_level} /> : <span className="text-xs text-txt-mute">not analysed</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
