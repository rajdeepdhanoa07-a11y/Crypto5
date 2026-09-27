import Link from 'next/link';
import { latestScan, currentFx } from '@/lib/data';
import type { MarketOverview } from '@/lib/scan';
import { money, price, pct, num, when } from '@/lib/format';
import { ema } from '@/lib/analysis/technicals';
import { Panel, Stat, Change, Empty, Disclaimer, cn, SourceLine } from '@/components/ui';
import { PriceChart, Bars } from '@/components/Charts';

export const metadata = { title: 'Market' };

function chartData(series: [number, number][]) {
  const p = series.map((x) => x[1]);
  const e20 = ema(p, 10), e50 = ema(p, 25), e200 = ema(p, 100); // chart points are every 2 days
  return series.map(([t, v], i) => ({ t, p: v, v: 0, e20: e20[i], e50: e50[i], e200: e200[i] }));
}

export default async function MarketPage() {
  const scan = await latestScan();
  const fx = await currentFx();
  if (!scan) return <Panel><Empty title="No market data yet">Run today’s scan first.</Empty></Panel>;
  const mk = scan.market as unknown as MarketOverview;
  const T = (tech: MarketOverview['btc']['tech']) => tech ? [
    ['RSI(14)', num(tech.rsi14, 0)], ['vs 50 EMA', tech.price && tech.ema50 ? pct((tech.price / tech.ema50 - 1) * 100) : 'N/A'], ['vs 200 EMA', tech.price && tech.ema200 ? pct((tech.price / tech.ema200 - 1) * 100) : 'N/A'],
    ['30D volatility', tech.volatility30d ? `${tech.volatility30d.toFixed(0)}%` : 'N/A'], ['30D', pct(tech.perf30d)], ['90D', pct(tech.perf90d)],
  ] : [];
  return (
    <>
      <h1 className="mb-4 text-sm font-bold uppercase tracking-[0.16em]">Market overview <span className="font-normal normal-case tracking-normal text-txt-mute">· scan of {scan.scanDate}</span></h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="BTC price" metric={mk.btc.price} value={price(mk.btc.price.value, fx)} sub={<>7D <Change v={mk.btc.change7d.value} /></>} />
        <Stat label="ETH price" metric={mk.eth.price} value={price(mk.eth.price.value, fx)} sub={<>7D <Change v={mk.eth.change7d.value} /></>} />
        <Stat label="Total market cap" metric={mk.totalMarketCap} value={money(mk.totalMarketCap.value, fx)} sub={<>24H <Change v={mk.totalMcapChange24h.value} /></>} />
        <Stat label="24H volume" metric={mk.volume24h} value={money(mk.volume24h.value, fx)} />
        <Stat label="BTC dominance" metric={mk.btcDominance} value={`${num(mk.btcDominance.value, 1)}%`} />
        <Stat label="ETH dominance" metric={mk.ethDominance} value={`${num(mk.ethDominance.value, 1)}%`} />
        <Stat label="Fear & Greed" metric={mk.fearGreed} value={num(mk.fearGreed.value)} sub={mk.fearGreed.label} />
        <Stat label="Stablecoin market cap" metric={mk.stablecoinMcap} value={money(mk.stablecoinMcap.value, fx)} />
        <Stat label="BTC 7D trend" metric={mk.btc.change7d} value={pct(mk.btc.change7d.value)} sub={mk.btc.tech?.momentum?.toLowerCase() ?? ''} />
        <Stat label="ETH 7D trend" metric={mk.eth.change7d} value={pct(mk.eth.change7d.value)} sub={mk.eth.tech?.momentum?.toLowerCase() ?? ''} />
        <Stat label="Altcoin 7D trend" metric={mk.alt7d} value={pct(mk.alt7d.value)} sub={`${num(mk.breadth7d.value)}% of top-100 alts up`} />
        <Stat label="USD / INR" metric={mk.usdInr} value={num(mk.usdInr.value, 2)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title={<>Market regime: <span className="text-amber">{mk.regime}</span></>}>
          <div className="px-4 py-3">
            <p className="mb-3 text-xs text-txt-mute">Rule-based reading of current conditions ({mk.regimeConfidence.toLowerCase()} confidence). It describes the market today; it is not a forecast. Each signal votes +1 bullish, −1 bearish; ≥+3 = bullish, ≤−3 = bearish; high BTC volatility overrides.</p>
            <table className="tbl">
              <thead><tr><th>Signal</th><th className="text-right">Value</th><th className="text-right">Reads</th></tr></thead>
              <tbody>
                {mk.evidence.map((e) => (
                  <tr key={e.signal}><td className="text-txt-soft">{e.signal}</td><td className="num text-right">{e.value}</td>
                    <td className={cn('text-right text-xs font-semibold uppercase', e.reads === 'bullish' ? 'text-up' : e.reads === 'bearish' ? 'text-down' : e.reads === 'volatile' ? 'text-warn' : 'text-txt-mute')}>{e.reads}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-txt-mute">Net score: {mk.regimeScore > 0 ? '+' : ''}{mk.regimeScore}</p>
          </div>
        </Panel>
        <Panel title="Fear & Greed (last 8 days)" action={<span className="text-[10px] normal-case tracking-normal text-txt-mute">{mk.fearGreed.source}</span>}>
          <div className="px-2 py-3">{mk.fearGreed.history?.length ? <Bars data={mk.fearGreed.history.map((h) => ({ label: new Date(h.t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), v: h.v }))} name="Index" height={200} /> : <Empty title="N/A" />}</div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {([['BTC', mk.btc], ['ETH', mk.eth]] as const).map(([n, x]) => (
          <Panel key={n} title={`${n} — 1 year`} action={<span className="text-[10px] normal-case tracking-normal text-txt-mute">CoinGecko market_chart · {when(x.price.at)}</span>}>
            <div className="px-2 pt-3">{x.chart.length ? <PriceChart data={chartData(x.chart)} height={260} /> : <Empty title="Chart N/A" />}</div>
            <dl className="grid grid-cols-3 gap-2 border-t border-term-line px-4 py-3 text-xs sm:grid-cols-6">{T(x.tech).map(([k, v]) => <div key={k}><dt className="text-txt-mute">{k}</dt><dd className="num mt-0.5">{v}</dd></div>)}</dl>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {([['Top 7D gainers (volume > $1M)', mk.topGainers], ['Top 7D losers (volume > $1M)', mk.topLosers]] as const).map(([t, rows]) => (
          <Panel key={t} title={t}>
            <table className="tbl"><tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/coin/${r.id}`} className="font-semibold hover:text-amber">{r.name}</Link> <span className="num text-xs uppercase text-txt-mute">{r.symbol}</span></td><td className="num text-right">{price(r.price, fx)}</td><td className="text-right"><Change v={r.change7d} /></td></tr>)}</tbody></table>
            <p className="px-4 py-2 text-[11px] text-txt-mute">Big short-term moves are shown for context only; they are not research picks.</p>
          </Panel>
        ))}
      </div>
      <SourceLine metric={mk.totalMarketCap} />
      <Disclaimer className="mt-6" />
    </>
  );
}
