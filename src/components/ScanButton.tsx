'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ScanButton({ big }: { big?: boolean }) {
  const [state, setState] = useState<{ status: string; progress?: string | null } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const poll = () => {
    if (timer.current) return;
    timer.current = setInterval(async () => {
      const r = await fetch('/api/scan/latest', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
      if (!r) return;
      setState({ status: r.status, progress: r.progress });
      if (r.status !== 'RUNNING') { clearInterval(timer.current!); timer.current = null; router.refresh(); }
    }, 2000);
  };
  useEffect(() => {
    fetch('/api/scan/latest', { cache: 'no-store' }).then((x) => x.json()).then((r) => { if (r.status === 'RUNNING') { setState(r); poll(); } }).catch(() => {});
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const running = state?.status === 'RUNNING';
  return (
    <div className="flex items-center gap-3">
      {running && <span role="status" className="hidden max-w-64 truncate text-xs text-txt-soft lg:inline">{state?.progress}</span>}
      {state?.status === 'FAILED' && <span role="alert" className="hidden max-w-72 truncate text-xs text-down lg:inline">Scan failed: {state.progress}</span>}
      <button className={big ? 'btn-amber px-5 py-3 text-base' : 'btn-amber btn-sm'} disabled={running}
        onClick={() => { setState({ status: 'RUNNING', progress: 'Starting…' }); fetch('/api/scan', { method: 'POST' }).catch(() => {}); setTimeout(poll, 800); }}>
        {running ? 'Scanning…' : "Run today's scan"}
      </button>
    </div>
  );
}
