'use client';
export function PrintButton() {
  return <button className="btn-ghost btn-sm" onClick={() => window.print()}>Print / save as PDF</button>;
}
