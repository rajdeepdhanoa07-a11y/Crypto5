import Link from 'next/link';
import type { Analysis } from '@/lib/scan';
import type { Fx } from '@/lib/format';
import { money, price, pct } from '@/lib/format';
import { Change, CoinLogo, M, Risk, ScorePill, cn } from './ui';

export function CandidateCard({ rank, id, name, symbol, image, a, fx }: { rank: number; id: string; name: string; symbol: string; image: string | null; a: Analysis; fx: Fx }) {
  const mt = a.metrics;
  return (
    <article className="panel flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="num text-xs font-bold text-amber">#{rank}</span>
        <CoinLogo src={image} symbol={symbol} size={34} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{name}</h3>
          <p className="num text-xs uppercase text-txt-mute">{symbol}</p>
        </div>
        <ScorePill score={a.score.total} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div><dt className="text-[10px] uppercase tracking-wider text-txt-mute">Price</dt><dd className="num"><M metric={mt.price}>{price(mt.price.value as number, fx)}</M></dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-txt-mute">Market cap</dt><dd className="num"><M metric={mt.marketCap}>{money(mt.marketCap.value as number, fx)}</M></dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-txt-mute">7D</dt><dd><Change v={mt.change7d.value as number | null} /></dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-txt-mute">30D</dt><dd><Change v={mt.change30d.value as number | null} /></dd></div>
      </dl>
      <div className="mt-3"><Risk level={a.score.risk} /></div>
      <div className="mt-3 space-y-2 border-t border-term-line pt-3 text-xs leading-relaxed">
        <p><span className="font-semibold uppercase tracking-wider text-txt-mute">Key catalyst </span><span className="text-txt-soft">{a.narrative.keyCatalyst ?? 'None recorded'}</span></p>
        <p><span className="font-semibold uppercase tracking-wider text-txt-mute">Main risk </span><span className="text-txt-soft">{a.narrative.mainRisk}</span></p>
      </div>
      <Link href={`/coin/${id}`} className="btn-ghost btn-sm mt-4 w-full">View full analysis</Link>
    </article>
  );
}

export function ScoreBreakdown({ a, compact }: { a: Analysis; compact?: boolean }) {
  return (
    <div className="space-y-2.5">
      {a.score.components.map((c) => {
        const r = c.max ? c.points / c.max : 0;
        return (
          <details key={c.key} className="group" open={!compact && false}>
            <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
              <span className="w-40 shrink-0 text-txt-soft">{c.label}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-term-raised" aria-hidden>
                <span className={cn('absolute inset-y-0 left-0 rounded-full', r >= 0.7 ? 'bg-up' : r >= 0.45 ? 'bg-amber' : 'bg-down')} style={{ width: `${r * 100}%` }} />
              </span>
              <span className="num w-14 text-right font-semibold">{c.points}/{c.max}</span>
              <span className="text-txt-mute transition group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <ul className="mb-1 ml-2 mt-2 space-y-1 border-l border-term-line pl-3 text-xs">
              {c.items.map((i, k) => (
                <li key={k} className="flex gap-3">
                  <span className="w-44 shrink-0 text-txt-mute">{i.label}</span>
                  <span className={cn('flex-1', i.na ? 'text-txt-mute italic' : 'text-txt-soft')}>{i.detail}</span>
                  <span className={cn('num w-14 text-right', i.points < 0 ? 'text-down' : '')}>{i.max ? `${i.points}/${i.max}` : i.points}</span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      <p className="flex items-center justify-between border-t border-term-line pt-2 text-sm">
        <span className="font-semibold uppercase tracking-wider text-txt-soft">Total research score</span>
        <span className="num font-bold text-amber">{a.score.total}/100</span>
      </p>
      <p className="text-[11px] text-txt-mute">Data coverage {(a.score.coverage * 100).toFixed(0)}%. Items marked N/A get a fixed neutral 40% of their points. This score is a research ranking, not a prediction of returns.</p>
    </div>
  );
}

export function FlagList({ a }: { a: Analysis }) {
  if (!a.score.flags.length) return <p className="text-sm text-txt-mute">No red flags detected in available data. Holder concentration, insider wallets and contract security are not measured with free sources.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {a.score.flags.map((f, i) => (
        <li key={i} className="flex gap-2"><span className={cn('mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-bold uppercase', f.severity === 'SERIOUS' ? 'bg-down/20 text-down' : 'bg-warn/15 text-warn')}>{f.severity === 'SERIOUS' ? 'Red flag' : 'Warning'}</span><span className="text-txt-soft">{f.text}</span></li>
      ))}
    </ul>
  );
}

export function pctOrNA(v: unknown) { return typeof v === 'number' ? pct(v) : 'N/A'; }
