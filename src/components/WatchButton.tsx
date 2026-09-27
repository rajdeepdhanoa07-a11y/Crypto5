'use client';
import { useState, useTransition } from 'react';
import { toggleWatch } from '@/app/actions/user';

export function WatchButton({ coin, watched }: { coin: { coinId: string; symbol: string; name: string; image: string | null }; watched: boolean }) {
  const [on, setOn] = useState(watched);
  const [pending, start] = useTransition();
  return (
    <button className={on ? 'btn-ghost btn-sm border-amber/60 text-amber' : 'btn-ghost btn-sm'} disabled={pending} aria-pressed={on}
      onClick={() => start(async () => { await toggleWatch(coin, !on); setOn(!on); })}>
      {on ? '★ On watchlist' : '☆ Add to watchlist'}
    </button>
  );
}
