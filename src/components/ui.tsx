import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Metric } from '@/lib/metric';
import { when } from '@/lib/format';

export const cn = (...a: (string | false | null | undefined)[]) => clsx(a);

export function Panel({ title, action, children, className, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('panel scroll-mt-20', className)}>
      {(title || action) && <header className="panel-h"><h2>{title}</h2>{action}</header>}
      {children}
    </section>
  );
}

/** Shows a metric value with its source and timestamp (hover / focus to read). */
export function M({ metric, children, className }: { metric?: Metric<unknown> | null; children?: ReactNode; className?: string }) {
  if (!metric) return <span className="text-txt-mute">N/A</span>;
  const na = metric.value === null || metric.value === undefined;
  const title = `Source: ${metric.source}${metric.at ? `\nUpdated: ${when(metric.at)}` : ''}${metric.note ? `\n${metric.note}` : ''}${metric.estimate ? '\nESTIMATE' : ''}`;
  return (
    <span className={cn('group relative inline-flex items-baseline gap-1', className)} title={title} tabIndex={0}>
      {na ? <span className="text-txt-mute">N/A</span> : children}
      {metric.estimate && !na && <span className="rounded bg-warn/15 px-1 text-[9px] font-bold uppercase tracking-wider text-warn">Est.</span>}
    </span>
  );
}

export function SourceLine({ metric }: { metric?: Metric<unknown> | null }) {
  if (!metric) return null;
  return <p className="mt-0.5 truncate text-[10px] text-txt-mute">{metric.source}{metric.at ? ` · ${when(metric.at)}` : ''}</p>;
}

export function Change({ v, className }: { v: number | null | undefined; className?: string }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <span className={cn('num text-txt-mute', className)}>N/A</span>;
  return <span className={cn('num', v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-txt-soft', className)}>{v > 0 ? '▲' : v < 0 ? '▼' : ''} {Math.abs(v).toFixed(1)}%</span>;
}

const RISK: Record<string, string> = {
  'LOWER RELATIVE RISK': 'border-up/40 text-up',
  'MEDIUM RISK': 'border-warn/40 text-warn',
  'HIGH RISK': 'border-[#f08a4b]/50 text-[#f08a4b]',
  'VERY HIGH / SPECULATIVE': 'border-down/50 text-down',
};
export function Risk({ level }: { level: string }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', RISK[level] ?? 'border-term-line2 text-txt-soft')}>{level}</span>;
}

export function ScorePill({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  const tone = score >= 75 ? 'text-up' : score >= 60 ? 'text-amber' : score >= 45 ? 'text-warn' : 'text-down';
  return (
    <span className={cn('num inline-flex items-baseline font-bold', tone, size === 'lg' ? 'text-4xl' : 'text-lg')}>
      {score}<span className={cn('font-medium text-txt-mute', size === 'lg' ? 'text-base' : 'text-xs')}>/100</span>
    </span>
  );
}

export function CoinLogo({ src, symbol, size = 28 }: { src?: string | null; symbol: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-term-raised" />;
  }
  return <span className="flex shrink-0 items-center justify-center rounded-full bg-term-raised text-[10px] font-bold uppercase text-txt-soft ring-1 ring-term-line2" style={{ width: size, height: size }}>{symbol.slice(0, 3)}</span>;
}

export function CoinName({ id, name, symbol, image }: { id: string; name: string; symbol: string; image?: string | null }) {
  return (
    <Link href={`/coin/${id}`} className="flex min-w-0 items-center gap-2 hover:text-amber">
      <CoinLogo src={image} symbol={symbol} size={22} />
      <span className="truncate font-semibold">{name}</span>
      <span className="num text-xs uppercase text-txt-mute">{symbol}</span>
    </Link>
  );
}

export function Stat({ label, value, sub, metric }: { label: string; value: ReactNode; sub?: ReactNode; metric?: Metric<unknown> | null }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-mute">{label}</p>
      <div className="num mt-1 text-xl font-semibold text-txt">{metric ? <M metric={metric}>{value}</M> : value}</div>
      {sub && <div className="mt-0.5 text-xs text-txt-soft">{sub}</div>}
      {metric && <SourceLine metric={metric} />}
    </div>
  );
}

export function Bullets({ items, tone }: { items: string[]; tone?: 'up' | 'down' | 'warn' | 'none' }) {
  if (!items.length) return <p className="text-sm text-txt-mute">None identified from available data.</p>;
  const dot = tone === 'up' ? 'bg-up' : tone === 'down' ? 'bg-down' : tone === 'warn' ? 'bg-warn' : 'bg-txt-mute';
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-txt-soft">
      {items.map((t, i) => <li key={i} className="flex gap-2"><span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />{t}</li>)}
    </ul>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cn('border-t border-term-line pt-3 text-xs leading-relaxed text-txt-mute', className)}>These results are market research generated from available data. They are not guarantees of future performance. Cryptocurrency markets are highly volatile and involve substantial risk.</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="px-6 py-12 text-center"><p className="font-semibold">{title}</p>{children && <div className="mx-auto mt-2 max-w-lg text-sm text-txt-soft">{children}</div>}</div>;
}
