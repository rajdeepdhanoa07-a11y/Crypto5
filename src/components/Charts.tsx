'use client';
import { ResponsiveContainer, ComposedChart, LineChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart, ReferenceLine } from 'recharts';

// Validated dark-mode categorical slots (blue, orange, aqua) + chart chrome.
const S1 = '#3987e5', S2 = '#d95926', S3 = '#199e70', GRID = '#232a35', AXIS = '#6f7a89', AMBER = '#f5a524';
const dayTick = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const fmtP = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v >= 1 ? v.toFixed(2) : v.toPrecision(3));
const fmtBig = (v: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

function Tip({ active, payload, label, fmt = fmtP, isDate = true }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number | string; fmt?: (v: number) => string; isDate?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-term-line2 bg-term-raised px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-txt">{isDate && typeof label === 'number' ? new Date(label).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : label}</p>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-txt-soft"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}<span className="num ml-auto pl-4 text-txt">{fmt(p.value)}</span></p>
      ))}
    </div>
  );
}

const axis = { stroke: AXIS, fontSize: 10, tickLine: false as const };

export function PriceChart({ data, height = 300 }: { data: { t: number; p: number; v: number; e20: number | null; e50: number | null; e200: number | null }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={dayTick} {...axis} minTickGap={40} />
          <YAxis yAxisId="p" orientation="right" tickFormatter={fmtP} {...axis} axisLine={false} domain={['auto', 'auto']} width={64} />
          <YAxis yAxisId="v" hide domain={[0, (max: number) => max * 4]} />
          <Tooltip content={<Tip />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: AXIS }} />
          <Bar yAxisId="v" dataKey="v" name="Volume" fill="#2e3642" isAnimationActive={false} />
          <Line yAxisId="p" dataKey="p" name="Price" stroke={S1} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="e20" name="EMA 20" stroke={AMBER} strokeWidth={1.2} dot={false} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="e50" name="EMA 50" stroke={S2} strokeWidth={1.2} dot={false} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="e200" name="EMA 200" stroke={S3} strokeWidth={1.2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Coin vs BTC vs ETH, each indexed to 100 at the start of the window. */
export function RelativeChart({ data, height = 220, name }: { data: { t: number; coin: number; btc: number | null; eth: number | null }[]; height?: number; name: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={dayTick} {...axis} minTickGap={40} />
          <YAxis orientation="right" {...axis} axisLine={false} width={40} domain={['auto', 'auto']} />
          <ReferenceLine y={100} stroke={AXIS} strokeDasharray="3 3" />
          <Tooltip content={<Tip fmt={(v) => v.toFixed(1)} />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="coin" name={name} stroke={S1} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="btc" name="BTC" stroke={S2} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="eth" name="ETH" stroke={S3} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaSeries({ data, height = 180, name, money }: { data: { t: number; v: number }[]; height?: number; name: string; money?: boolean }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id={`g-${name}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={S1} stopOpacity={0.35} /><stop offset="100%" stopColor={S1} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={dayTick} {...axis} minTickGap={40} />
          <YAxis orientation="right" tickFormatter={money ? (v) => '$' + fmtBig(v) : fmtP} {...axis} axisLine={false} width={56} domain={['auto', 'auto']} />
          <Tooltip content={<Tip fmt={money ? (v) => '$' + fmtBig(v) : fmtP} />} />
          <Area dataKey="v" name={name} stroke={S1} strokeWidth={2} fill={`url(#g-${name})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, height = 140, name, color = S1 }: { data: { label: string; v: number }[]; height?: number; name: string; color?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis orientation="right" {...axis} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip content={<Tip isDate={false} fmt={(v) => v.toLocaleString('en-US', { maximumFractionDigits: 2 })} />} cursor={{ fill: 'rgba(57,135,229,0.08)' }} />
          <Bar dataKey="v" name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreHistory({ data, height = 160 }: { data: { label: string; score: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis orientation="right" domain={[0, 100]} {...axis} axisLine={false} width={32} />
          <Tooltip content={<Tip isDate={false} fmt={(v) => `${v}/100`} />} />
          <Line dataKey="score" name="Research score" stroke={AMBER} strokeWidth={2} dot={{ r: 3, fill: AMBER, stroke: '#11151b', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
