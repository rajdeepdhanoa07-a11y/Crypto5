'use client';
import { useTransition } from 'react';
import { toggleWatch, setAlertActive, deleteAlert, markEventsRead } from '@/app/actions/user';

export function RemoveWatch({ coin }: { coin: { coinId: string; symbol: string; name: string; image: string | null } }) {
  const [p, start] = useTransition();
  return <button className="text-xs text-txt-mute hover:text-down" disabled={p} onClick={() => start(() => toggleWatch(coin, false))}>Remove</button>;
}
export function AlertRowButtons({ id, active }: { id: number; active: boolean }) {
  const [p, start] = useTransition();
  return (
    <span className="inline-flex gap-3 text-xs">
      <button className="text-txt-soft hover:text-txt" disabled={p} onClick={() => start(() => setAlertActive(id, !active))}>{active ? 'Pause' : 'Resume'}</button>
      <button className="text-txt-mute hover:text-down" disabled={p} onClick={() => start(() => deleteAlert(id))}>Delete</button>
    </span>
  );
}
export function MarkRead() {
  const [p, start] = useTransition();
  return <button className="text-[10px] normal-case tracking-normal text-amber hover:underline" disabled={p} onClick={() => start(() => markEventsRead())}>Mark all read</button>;
}
