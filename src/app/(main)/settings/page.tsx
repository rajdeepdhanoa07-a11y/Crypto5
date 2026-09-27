import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSettings } from '@/lib/scan';
import { DATA_MODE } from '@/lib/providers/http';
import { PAID_SOURCES } from '@/lib/providers/others';
import { day } from '@/lib/format';
import { Panel, cn } from '@/components/ui';
import { ActionForm, CoinPicker } from '@/components/Forms';
import { saveSettings, addCatalyst } from '@/app/actions/user';
import { coinOptions } from '@/lib/coins';
import { CatalystButtons } from './CatalystButtons';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const s = await getSettings();
  const cats = await db.select().from(schema.catalysts).orderBy(desc(schema.catalysts.createdAt)).limit(100);
  const coins = await coinOptions();
  const has = (k: string) => !!process.env[k];
  const free = [
    { name: 'CoinGecko', provides: 'Prices, market caps, FDV, supply, volume, history, developer & community data', status: has('COINGECKO_API_KEY') ? `Connected (${(process.env.COINGECKO_PLAN ?? 'demo').toLowerCase()} key)` : 'Public limits (add a free Demo key)', ok: true },
    { name: 'DeFiLlama', provides: 'TVL, TVL history, fees, stablecoin market cap', status: 'Connected (free, no key)', ok: true },
    { name: 'alternative.me', provides: 'Fear & Greed index', status: 'Connected (free, no key)', ok: true },
    { name: 'GitHub', provides: 'Weekly commits, last push, releases', status: has('GITHUB_TOKEN') ? 'Connected' : 'Not configured (CoinGecko developer data used)', ok: has('GITHUB_TOKEN') },
    { name: 'CoinMarketCap', provides: 'Second source to cross-check price, market cap, volume', status: has('CMC_API_KEY') ? 'Connected' : 'Not configured (free key)', ok: has('CMC_API_KEY') },
    { name: 'CryptoPanic', provides: 'News headlines', status: has('CRYPTOPANIC_API_KEY') ? 'Connected' : 'Not configured (free key)', ok: has('CRYPTOPANIC_API_KEY') },
  ];
  const sel = (name: string, label: string, value: string, opts: [string, string][]) => (
    <div><label htmlFor={name} className="label">{label}</label><select id={name} name={name} defaultValue={value} className="input">{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );
  return (
    <>
      <h1 className="mb-4 text-sm font-bold uppercase tracking-[0.16em]">Settings</h1>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Scan preferences">
          <div className="p-4">
            <ActionForm action={saveSettings} submit="Save settings">
              <div className="grid gap-3 sm:grid-cols-2">
                {sel('currency', 'Currency', s.currency, [['USD', 'USD ($)'], ['INR', 'INR (₹)']])}
                {sel('priceFilter', 'Price filter', s.priceFilter, [['UNDER_1', 'Low-price opportunities (under $1)'], ['UNDER_0_01', 'Under $0.01'], ['0_01_0_10', '$0.01–$0.10'], ['0_10_1', '$0.10–$1'], ['1_10', '$1–$10'], ['OVER_1', '$1+'], ['OVER_10', '$10+'], ['ANY', 'Any price']])}
                {sel('riskPreference', 'Risk preference', s.riskPreference, [['CONSERVATIVE', 'Conservative (lower relative risk only)'], ['BALANCED', 'Balanced (up to medium)'], ['AGGRESSIVE', 'Aggressive (up to high)'], ['SPECULATIVE', 'Speculative (any risk level)']])}
                {sel('marketCap', 'Market cap', s.marketCap, [['ANY', 'Any'], ['MICRO', 'Micro (< $50M)'], ['SMALL', 'Small ($50M–$300M)'], ['MID', 'Mid ($300M–$2B)'], ['LARGE', 'Large (> $2B)']])}
                <div><label htmlFor="minVolumeUsd" className="label">Minimum daily volume (USD)</label><input id="minVolumeUsd" name="minVolumeUsd" type="number" min={0} step={100000} defaultValue={s.minVolumeUsd} className="input" /></div>
                <div><label htmlFor="universePages" className="label">Coins to scan (× 250)</label><input id="universePages" name="universePages" type="number" min={1} max={40} defaultValue={s.universePages} className="input" /><p className="mt-1 text-[11px] text-txt-mute">{s.universePages * 250} coins. Free CoinGecko plan: keep ≤ 8.</p></div>
                <div><label htmlFor="deepAnalyze" className="label">Candidates analysed in depth</label><input id="deepAnalyze" name="deepAnalyze" type="number" min={5} max={100} defaultValue={s.deepAnalyze} className="input" /><p className="mt-1 text-[11px] text-txt-mute">~2 API calls each. 30 ≈ 3 minutes on the free plan.</p></div>
              </div>
            </ActionForm>
          </div>
        </Panel>
        <Panel title={`Data sources · mode ${DATA_MODE}`}>
          <table className="tbl">
            <thead><tr><th>Source</th><th>Provides</th><th>Status</th></tr></thead>
            <tbody>
              {free.map((x) => <tr key={x.name}><td className="font-semibold">{x.name}</td><td className="whitespace-normal text-xs text-txt-soft">{x.provides}</td><td className={cn('text-xs', x.ok ? 'text-up' : 'text-txt-mute')}>{x.status}</td></tr>)}
              {PAID_SOURCES.map((x) => <tr key={x.name}><td className="font-semibold text-txt-soft">{x.name}</td><td className="whitespace-normal text-xs text-txt-mute">{x.provides}</td><td className="whitespace-normal text-xs text-warn">{x.status}</td></tr>)}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[11px] text-txt-mute">API keys are read only from environment variables on the server and are never sent to the browser. Metrics from sources that are not connected show N/A.</p>
        </Panel>
      </div>

      <Panel id="catalysts" className="mt-4" title="Catalysts, unlocks and security incidents">
        <div className="grid gap-6 p-4 xl:grid-cols-[380px_1fr]">
          <ActionForm action={addCatalyst} submit="Add event">
            <p className="text-xs text-txt-mute">No reliable free API covers catalysts or unlocks, so record verified events here with the official source link. They feed the Catalyst and Tokenomics scores, red flags and alerts.</p>
            <div><label htmlFor="c-coin" className="label">Coin</label><CoinPicker coins={coins} id="c-coin" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="c-kind" className="label">Type</label><select id="c-kind" name="kind" className="input">{[['MAINNET', 'Mainnet launch'], ['UPGRADE', 'Major upgrade'], ['BURN', 'Token burn'], ['LISTING', 'New listing'], ['ETF', 'ETF development'], ['PARTNERSHIP', 'Partnership'], ['LAUNCH', 'Protocol launch'], ['GOVERNANCE', 'Governance change'], ['INCENTIVES', 'Ecosystem incentives'], ['RELEASE', 'Product release'], ['UNLOCK', 'Token unlock'], ['SECURITY', 'Security incident']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label htmlFor="c-date" className="label">Date</label><input id="c-date" name="eventDate" type="date" className="input" /></div>
            </div>
            <div><label htmlFor="c-ev" className="label">Event</label><input id="c-ev" name="event" className="input" required placeholder="v3 mainnet upgrade" /></div>
            <div><label htmlFor="c-sig" className="label">Potential significance</label><input id="c-sig" name="significance" className="input" /></div>
            <div><label htmlFor="c-risk" className="label">Risk</label><input id="c-risk" name="risk" className="input" placeholder="Delay risk; sell-the-news" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="c-pct" className="label">Unlock % of supply</label><input id="c-pct" name="unlockPctOfSupply" className="input" inputMode="decimal" placeholder="only for unlocks" /></div>
              <div><label htmlFor="c-src" className="label">Official source link</label><input id="c-src" name="sourceUrl" type="url" className="input" required /></div>
            </div>
          </ActionForm>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Coin</th><th>Date</th><th>Type</th><th>Event</th><th>Source</th><th /></tr></thead>
              <tbody>
                {cats.length === 0 && <tr><td colSpan={6} className="text-txt-mute">No events recorded.</td></tr>}
                {cats.map((c) => <tr key={c.id} className={c.resolved ? 'opacity-50' : ''}><td className="num text-xs">{c.coinId}</td><td className="num text-xs">{c.eventDate ? day(c.eventDate) : 'N/A'}</td><td className="text-xs">{c.kind.toLowerCase()}{c.unlockPctOfSupply ? ` · ${c.unlockPctOfSupply}%` : ''}</td><td className="max-w-72 whitespace-normal">{c.event}</td><td>{c.sourceUrl && <a href={c.sourceUrl} className="text-xs text-amber" target="_blank" rel="noopener noreferrer">link ↗</a>}</td><td><CatalystButtons id={c.id} security={c.kind === 'SECURITY' && !c.resolved} /></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </>
  );
}
