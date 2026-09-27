'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AnalyzeButton({ coinId, label }: { coinId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end">
      <button className="btn-ghost btn-sm" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await fetch(`/api/analyze/${encodeURIComponent(coinId)}`, { method: 'POST' });
        if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? 'Analysis failed');
        setBusy(false); router.refresh();
      }}>{busy ? 'Analysing…' : label}</button>
      {err && <span role="alert" className="mt-1 text-xs text-down">{err}</span>}
    </div>
  );
}
