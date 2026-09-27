// Display formatting. All stored values are USD; INR is converted with the rate from the latest scan.
export type Fx = { currency: 'USD' | 'INR'; rate: number };
export const USD: Fx = { currency: 'USD', rate: 1 };

const sym = (fx: Fx) => (fx.currency === 'INR' ? '₹' : '$');

export function money(v: number | null | undefined, fx: Fx = USD): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  const x = v * fx.rate;
  const a = Math.abs(x);
  if (a >= 1e12) return `${sym(fx)}${(x / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sym(fx)}${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sym(fx)}${(x / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sym(fx)}${(x / 1e3).toFixed(1)}K`;
  return price(v, fx);
}

export function price(v: number | null | undefined, fx: Fx = USD): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  const x = v * fx.rate;
  const a = Math.abs(x);
  const s = sym(fx);
  if (a >= 1000) return s + x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 1) return s + x.toFixed(2);
  if (a >= 0.01) return s + x.toFixed(4);
  if (a === 0) return s + '0';
  return s + x.toPrecision(3);
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return v.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function compact(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
}

export function when(iso: string | Date | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function day(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
