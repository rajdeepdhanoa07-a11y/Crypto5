// Every number shown in the app is a Metric: value + where it came from + when.
// A missing value stays null and is displayed as "N/A". Estimates are always labelled.

export type Metric<T = number> = {
  value: T | null;
  source: string; // e.g. "CoinGecko /coins/markets"
  at: string | null; // ISO timestamp of the source data
  estimate?: boolean; // true = derived/estimated, shown with an ESTIMATE label
  note?: string;
};

export function m<T>(value: T | null | undefined, source: string, at: string | null, extra: Partial<Metric<T>> = {}): Metric<T> {
  return { value: value === undefined || (typeof value === 'number' && !Number.isFinite(value)) ? null : value, source, at, ...extra };
}

export const NA = (source: string, note?: string): Metric<never> => ({ value: null, source, at: null, note });

export function val<T>(x: Metric<T> | undefined | null): T | null {
  return x ? x.value : null;
}
