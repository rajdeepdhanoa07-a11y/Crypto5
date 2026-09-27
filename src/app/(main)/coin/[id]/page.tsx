import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { latestAnalysis, currentFx } from '@/lib/data';
import { money, price, pct, num, compact, when, day } from '@/lib/format';
import { ema } from '@/lib/analysis/technicals';
import type { Metric } from '@/lib/metric';
import { Panel, M, SourceLine, Change, Risk, ScorePill, CoinLogo, Bullets, Disclaimer, Empty, cn } from '@/components/ui';
import { ScoreBreakdown, FlagList } from '@/components/CoinBlocks';
import { PriceChart, RelativeChart, AreaSeries, Bars, ScoreHistory } from '@/components/Charts';
import { WatchButton } from '@/components/WatchButton';
import { AnalyzeButton } from '@/components/AnalyzeButton';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, params.id) });
  return { title: u ? `${u.name} (${u.symbol.toUpperCase()})` : 'Coin' };
}

function Row({ label, metric, children }: { label: string; metric?: Metric<unknown> | null; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-term-line/60 py-1.5 text-sm last:border-0">
      <dt className="shrink-0 text-txt-mute">{label}</dt>
      <dd className="min-w-0 text-right"><span className="num">{metric ? <M metric={metric}>{children}</M> : children}</span>{metric && <SourceLine metric={metric} />}</dd>
    </div>
  );
}

const SECTIONS = ['overview', 'chart', 'technical', 'fundamentals', 'tokenomics', 'onchain', 'development', 'catalysts', 'risks', 'news', 'history'];

export default async function CoinPage({ params }: { params: { id: string } }) {
  const u = await db.query.universe.findFirst({ where: eq(schema.universe.coinId, params.id) });
  if (!u) notFound();
  const fx = await currentFx();
  const row = await latestAnalysis(params.id);
  const watched = !!(await db.query.watchlist.findFirst({ where: eq(schema.watchlist.coinId, params.id) }));
  const history = await db.select({ score: schema.scanCoins.score, risk: schema.scanCoins.riskLevel, selected: schema.scanCoins.selected, date: schema.scans.scanDate, price: schema.scanCoins.priceUsd })
    .from(schema.scanCoins).innerJoin(schema.scans, eq(schema.scans.id, schema.scanCoins.scanId)).where(eq(schema.scanCoins.coinId, params.id)).orderBy(asc(schema.scanCoins.id));

  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <CoinLogo src={u.image} symbol={u.symbol} size={44} />
      <div className="mr-auto">
        <h1 className="text-2xl font-semibold">{u.name} <span className="num text-base uppercase text-txt-mute">{u.symbol}</span></h1>
        <p className="text-xs text-txt-mute">Rank #{u.rank ?? 'N/A'} · {u.sector ?? row?.a.profile.categories[0] ?? 'Sector N/A'} · market data {when(u.sourceAt)}</p>
      </div>
      <div className="text-right"><p className="num text-2xl font-semibold">{price(u.priceUsd, fx)}</p><p className="text-sm"><Change v={u.change24h} /> 24H</p></div>
      {row && <ScorePill score={row.score} size="lg" />}
      <div className="flex flex-col gap-2"><WatchButton coin={{ coinId: u.coinId, symbol: u.symbol, name: u.name, image: u.image }} watched={watched} /><AnalyzeButton coinId={u.coinId} label={row ? 'Re-analyse now' : 'Analyse now'} /></div>
    </div>
  );

  if (!row) {
    return (
      <>
        {header}
        <Panel><Empty title="Not analysed in depth yet">This coin was in the scanned market but not among today’s deep-analysis candidates. Click “Analyse now” to fetch its details, charts, developer and on-chain data (uses a few API calls).</Empty></Panel>
        <Panel className="mt-4" title="Market data">
          <dl className="grid gap-x-8 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
            <Row label="Market cap">{money(u.marketCap, fx)}</Row><Row label="FDV">{money(u.fdv, fx)}</Row><Row label="24H volume">{money(u.volume24h, fx)}</Row>
            <Row label="7D"><Change v={u.change7d} /></Row><Row label="30D"><Change v={u.change30d} /></Row><Row label="Circulating supply">{compact(u.circulating)}</Row>
          </dl>
          <p className="px-4 pb-3 text-[10px] text-txt-mute">Source: CoinGecko /coins/markets · {when(u.sourceAt)}</p>
        </Panel>
      </>
    );
  }

  const a = row.a, mt = a.metrics, n = a.narrative, t = a.facts.tech;
  const prices = a.chart.map((c) => c.p);
  const e20 = ema(prices, 20), e50 = ema(prices, 50), e200 = ema(prices, 200);
  const priceData = a.chart.map((c, i) => ({ t: c.t, p: c.p, v: c.v, e20: e20[i], e50: e50[i], e200: e200[i] }));
  const win = a.chart.slice(-180);
  const base = win[0];
  const relData = base ? win.map((c) => ({ t: c.t, coin: (c.p / base.p) * 100, btc: c.btc && base.btc ? (c.btc / base.btc) * 100 : null, eth: c.eth && base.eth ? (c.eth / base.eth) * 100 : null })) : [];
  const mcapData = a.chart.map((c) => ({ t: c.t, v: c.v }));

  return (
    <>
      {header}
      {a.dataMode === 'SAMPLE' && <p className="mb-3 rounded bg-warn/15 px-3 py-2 text-xs text-warn">Sample data: this is a fictional coin generated for testing.</p>}
      <nav className="no-print sticky top-14 z-20 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-term-line bg-term-bg/95 px-4 py-2 backdrop-blur" aria-label="Sections">
        {SECTIONS.map((s) => <a key={s} href={`#${s}`} className="whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-txt-soft hover:bg-term-raised hover:text-txt">{s === 'onchain' ? 'On-chain' : s === 'history' ? 'Score history' : s}</a>)}
      </nav>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel id="overview" title="Overview">
          <div className="grid gap-6 p-4 md:grid-cols-2">
            <div>
              <p className="text-sm leading-relaxed text-txt-soft">{a.profile.description || 'No project description available from CoinGecko.'}</p>
              <dl className="mt-3 text-sm">
                <Row label="Categories">{a.profile.categories.join(', ') || 'N/A'}</Row>
                <Row label="Launched (genesis)">{a.profile.genesis ? day(a.profile.genesis) : 'N/A'}</Row>
                <Row label="Platform">{a.profile.platform ?? 'Own chain / N/A'}</Row>
                <Row label="Community sentiment" metric={a.community.sentimentUp}>{num(a.community.sentimentUp.value as number, 0)}% up-votes</Row>
                <Row label="Social classification">{n.social}</Row>
              </dl>
              <p className="mt-1 text-xs text-txt-mute">{n.socialWhy} Social activity is not treated as evidence of future price moves.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {a.profile.homepage && <a className="btn-ghost btn-sm" href={a.profile.homepage} target="_blank" rel="noopener noreferrer">Website ↗</a>}
                {a.profile.twitter && <a className="btn-ghost btn-sm" href={a.profile.twitter} target="_blank" rel="noopener noreferrer">X ↗</a>}
                {a.profile.github[0] && <a className="btn-ghost btn-sm" href={a.profile.github[0]} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
                {a.profile.explorers[0] && <a className="btn-ghost btn-sm" href={a.profile.explorers[0]} target="_blank" rel="noopener noreferrer">Explorer ↗</a>}
              </div>
            </div>
            <dl>
              <Row label="Price" metric={mt.price}>{price(mt.price.value as number, fx)}</Row>
              <Row label="Market cap" metric={mt.marketCap}>{money(mt.marketCap.value as number, fx)}</Row>
              <Row label="FDV" metric={mt.fdv}>{money(mt.fdv.value as number, fx)}</Row>
              <Row label="24H volume" metric={mt.volume24h}>{money(mt.volume24h.value as number, fx)}</Row>
              <Row label="7D / 30D / 90D / 180D" metric={mt.change7d}><span className="space-x-2"><Change v={mt.change7d.value as number} /><Change v={mt.change30d.value as number} /><Change v={mt.change90d.value as number} /><Change v={mt.change180d.value as number} /></span></Row>
              <Row label="From all-time high" metric={mt.athChange}>{pct(mt.athChange.value as number)}</Row>
              <Row label="Risk level"><Risk level={a.score.risk} /></Row>
            </dl>
          </div>
          {a.crossCheck.length > 0 && (
            <div className="border-t border-term-line px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-mute">Source cross-check</p>
              <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Field</th><th className="text-right">CoinGecko</th><th className="text-right">CoinMarketCap</th><th className="text-right">Diff</th><th>Why they differ</th></tr></thead>
                <tbody>{a.crossCheck.map((x) => <tr key={x.field}><td>{x.field}</td><td className="num text-right">{x.field === 'Price' ? price(x.coingecko, fx) : money(x.coingecko, fx)}</td><td className="num text-right">{x.field === 'Price' ? price(x.cmc, fx) : money(x.cmc, fx)}</td><td className={cn('num text-right', Math.abs(x.diffPct ?? 0) >= 2 && 'text-warn')}>{pct(x.diffPct)}</td><td className="whitespace-normal text-xs text-txt-soft">{x.note}</td></tr>)}</tbody></table></div>
            </div>
          )}
        </Panel>
        <Panel title={`Research score ${a.score.total}/100`}>
          <div className="p-4"><ScoreBreakdown a={a} /></div>
        </Panel>
      </div>

      <Panel id="chart" className="mt-4" title="Price chart (1 year, daily)" action={<span className="text-[10px] normal-case tracking-normal text-txt-mute">CoinGecko market_chart · EMAs calculated</span>}>
        <div className="px-2 pt-3">{priceData.length ? <PriceChart data={priceData} height={340} /> : <Empty title="Chart N/A" />}</div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-txt-mute">Performance vs BTC and ETH (180 days, indexed to 100)</p>{relData.length ? <RelativeChart data={relData} name={u.symbol.toUpperCase()} /> : <Empty title="N/A" />}</div>
          <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-txt-mute">Daily trading volume</p>{mcapData.length ? <AreaSeries data={mcapData.slice(-180)} name="Volume" money height={220} /> : <Empty title="N/A" />}</div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel id="technical" title="Technical analysis">
          <dl className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
            <Row label="RSI (14)" metric={mt.rsi14}>{num(mt.rsi14.value as number, 1)}</Row>
            <Row label="MACD / signal" metric={mt.macd}>{num(mt.macd.value as number, 6)} / {num(mt.macdSignal.value as number, 6)}</Row>
            <Row label="MACD histogram" metric={mt.macdHist}><span className={(mt.macdHist.value as number) > 0 ? 'text-up' : 'text-down'}>{num(mt.macdHist.value as number, 6)}</span></Row>
            <Row label="20 EMA" metric={mt.ema20}>{price(mt.ema20.value as number, fx)}</Row>
            <Row label="50 EMA" metric={mt.ema50}>{price(mt.ema50.value as number, fx)}</Row>
            <Row label="200 EMA" metric={mt.ema200}>{price(mt.ema200.value as number, fx)}</Row>
            <Row label="Support" metric={mt.support}>{price(mt.support.value as number, fx)}</Row>
            <Row label="Resistance" metric={mt.resistance}>{price(mt.resistance.value as number, fx)}</Row>
            <Row label="Volume trend" metric={mt.volumeTrend}>{pct(mt.volumeTrend.value as number)}</Row>
            <Row label="Volatility (30D, annual)" metric={mt.volatility30d}>{num(mt.volatility30d.value as number, 0)}%</Row>
            <Row label="Momentum">{t?.momentum ?? 'N/A'}</Row>
            <Row label="30D vs BTC" metric={mt.vsBtc30d}>{pct(mt.vsBtc30d.value as number)}</Row>
            <Row label="30D vs ETH" metric={mt.vsEth30d}>{pct(mt.vsEth30d.value as number)}</Row>
            <Row label="7D vs altcoin market" metric={mt.vsMarket7d}>{pct(mt.vsMarket7d.value as number)}</Row>
          </dl>
          <p className="px-4 pb-3 text-xs text-txt-soft">{n.technicalSetup}</p>
        </Panel>

        <Panel id="fundamentals" title="Fundamentals">
          <div className="space-y-3 p-4 text-sm">
            <p className="text-txt-soft">{n.fundamentalThesis}</p>
            <dl>
              <Row label="What it does">{a.profile.categories.slice(0, 3).join(', ') || 'N/A'}</Row>
              <Row label="Is it used? (TVL)" metric={a.onchain.tvl}>{money(a.onchain.tvl.value as number, fx)}</Row>
              <Row label="Fees (30D)" metric={a.onchain.fees30d}>{money(a.onchain.fees30d.value as number, fx)}</Row>
              <Row label="Revenue">N/A <span className="text-[10px] text-txt-mute">(Token Terminal – paid)</span></Row>
              <Row label="Users / transactions">N/A <span className="text-[10px] text-txt-mute">(on-chain analytics – paid)</span></Row>
              <Row label="Exchanges listing it" metric={mt.exchanges}>{num(mt.exchanges.value as number)}</Row>
            </dl>
            <p className="text-xs text-txt-mute">Competitors, partnerships and integrations are not available from free structured sources; check the project’s official channels.</p>
            {a.exchanges.length > 0 && (
              <details><summary className="cursor-pointer text-xs font-semibold text-txt-soft">Top markets by volume</summary>
                <div className="overflow-x-auto"><table className="tbl mt-2"><tbody>{a.exchanges.map((x, i) => <tr key={i}><td>{x.name}</td><td className="text-xs text-txt-mute">/{x.target}</td><td className="num text-right">{money(x.volumeUsd, fx)}</td><td className="text-xs">{x.trust ?? ''}</td></tr>)}</tbody></table></div>
              </details>
            )}
          </div>
        </Panel>

        <Panel id="tokenomics" title="Tokenomics">
          <dl className="px-4 py-2">
            <Row label="Circulating supply" metric={mt.circulating}>{compact(mt.circulating.value as number)}</Row>
            <Row label="Total supply" metric={mt.totalSupply}>{compact(mt.totalSupply.value as number)}</Row>
            <Row label="Max supply" metric={mt.maxSupply}>{mt.maxSupply.value === null ? 'No cap / N/A' : compact(mt.maxSupply.value as number)}</Row>
            <Row label="Circulating %" metric={mt.circulatingPct}>{num(mt.circulatingPct.value as number, 1)}%</Row>
            <Row label="FDV ÷ market cap" metric={mt.fdvRatio}>{num(mt.fdvRatio.value as number, 2)}×</Row>
            <Row label="Inflation / emissions" metric={mt.inflation}>—</Row>
            <Row label="Insider / investor allocation">N/A <span className="text-[10px] text-txt-mute">(not in free sources)</span></Row>
            <Row label="Upcoming unlocks">{a.catalysts.filter((c) => c.kind === 'UNLOCK').map((c) => `${c.date}: ${c.event}`).join('; ') || 'None recorded'}</Row>
          </dl>
          {n.lowPriceNote && <p className="mx-4 mb-4 rounded-md bg-term-raised p-3 text-xs leading-relaxed text-txt-soft">{n.lowPriceNote}</p>}
        </Panel>

        <Panel id="onchain" title="On-chain & ecosystem">
          <dl className="px-4 py-2">
            <Row label="TVL" metric={a.onchain.tvl}>{money(a.onchain.tvl.value as number, fx)}</Row>
            <Row label="TVL 7D change" metric={a.onchain.tvl7d}>{pct(a.onchain.tvl7d.value as number)}</Row>
            <Row label="TVL 30D change" metric={a.onchain.tvl30d}>{pct(a.onchain.tvl30d.value as number)}</Row>
          </dl>
          {a.onchain.tvlHistory.length > 0 && <div className="px-2"><AreaSeries data={a.onchain.tvlHistory} name="TVL" money height={160} /></div>}
          <p className="px-4 py-3 text-xs text-txt-mute"><span className="font-semibold text-txt-soft">Actual data:</span> TVL from DeFiLlama. <span className="font-semibold text-txt-soft">Not measured (needs paid on-chain data):</span> {a.onchain.notMeasured.join(', ')}.</p>
        </Panel>

        <Panel id="development" title="Development">
          <dl className="px-4 py-2">
            <Row label="Commits (4 weeks)" metric={a.dev.commits4w}>{num(a.dev.commits4w.value as number)}</Row>
            <Row label="Contributors" metric={a.dev.contributors}>{num(a.dev.contributors.value as number)}</Row>
            <Row label="Development trend">{pct(a.facts.devTrend)}</Row>
            <Row label="Last code push" metric={a.dev.lastPush}>{a.dev.lastPush.value as string}</Row>
            <Row label="GitHub stars" metric={a.dev.stars}>{num(a.dev.stars.value as number)}</Row>
          </dl>
          {a.dev.weekly.length > 0 && <div className="px-2"><Bars data={a.dev.weekly.map((v, i) => ({ label: `W${i + 1 - a.dev.weekly.length}`, v }))} name="Commits" height={130} /></div>}
          <div className="px-4 py-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-txt-mute">Recent releases</p>
            {a.dev.releases.length ? <ul className="space-y-1">{a.dev.releases.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">{r.name}</a> <span className="text-xs text-txt-mute">{day(r.date)}</span></li>)}</ul> : <p className="text-txt-mute">N/A{process.env.GITHUB_TOKEN ? '' : ' (add a GITHUB_TOKEN for release data)'}</p>}
          </div>
        </Panel>

        <Panel id="catalysts" title="Catalysts">
          <div className="p-4">
            {a.catalysts.length ? (
              <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Date</th><th>Event</th><th>Potential significance</th><th>Risk</th></tr></thead>
                <tbody>{a.catalysts.map((c) => <tr key={c.id}><td className="num">{c.date ?? 'N/A'}</td><td className="whitespace-normal">{c.event}{c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-amber">↗</a>}</td><td className="whitespace-normal text-xs text-txt-soft">{c.significance ?? '—'}</td><td className="whitespace-normal text-xs text-txt-soft">{c.risk ?? '—'}</td></tr>)}</tbody></table></div>
            ) : <p className="text-sm text-txt-mute">No catalysts recorded. There is no reliable free catalyst API, so add verified events (with the official source link) in <Link href="/settings#catalysts" className="text-amber hover:underline">Settings → Catalysts</Link>. A catalyst never guarantees a price move.</p>}
          </div>
        </Panel>
      </div>

      <Panel id="risks" className="mt-4" title="Risks">
        <div className="grid gap-6 p-4 lg:grid-cols-3">
          <section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-warn">Red flags</h3><FlagList a={a} /><p className="mt-3 text-xs text-txt-mute">Risk level drivers: {a.score.riskReasons.join('; ')}.</p></section>
          <section className="rounded-md border border-down/40 bg-down/5 p-3"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-down">Why you should not buy this coin</h3><Bullets items={n.whyNot} tone="down" /></section>
          <section className="space-y-4">
            <div><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Evidence supporting the thesis</h3><Bullets items={n.whyQualified} tone="up" /></div>
            <div><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-txt-soft">Invalidation conditions</h3><Bullets items={n.invalidation} tone="warn" /></div>
          </section>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel id="news" title="News">
          <div className="p-4">
            {a.news === null ? <p className="text-sm text-txt-mute">N/A — add a free CRYPTOPANIC_API_KEY to show headlines. Always confirm important news on the project’s official channels.</p> : a.news.length === 0 ? <p className="text-sm text-txt-mute">No recent headlines.</p> : (
              <ul className="space-y-2 text-sm">{a.news.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noopener noreferrer" className="hover:text-amber">{x.title}</a><p className="text-[10px] text-txt-mute">{x.source} · {when(x.at)}</p></li>)}</ul>
            )}
          </div>
        </Panel>
        <Panel id="history" title="Historical research scores">
          <div className="p-2">{history.length > 1 ? <ScoreHistory data={history.map((h) => ({ label: h.date.slice(5), score: h.score }))} /> : <p className="p-3 text-sm text-txt-mute">Only one analysis so far. Scores build up with every daily scan.</p>}</div>
          <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Date</th><th className="text-right">Score</th><th>Risk</th><th className="text-right">Price</th><th>Daily 5?</th></tr></thead>
            <tbody>{history.slice(-10).reverse().map((h, i) => <tr key={i}><td className="num">{h.date}</td><td className="num text-right">{h.score}</td><td><Risk level={h.risk} /></td><td className="num text-right">{price(h.price, fx)}</td><td>{h.selected ? <span className="text-amber">Yes</span> : '—'}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-txt-mute">Analysed {when(a.analyzedAt)}. Hover or focus any number to see its source and timestamp.</p>
      <Disclaimer className="mt-4" />
    </>
  );
}
