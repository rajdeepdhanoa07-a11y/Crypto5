'use client';
import { useState, useTransition } from 'react';
import { saveScreen, deleteScreen } from '@/app/actions/user';

export function SaveScreen({ filters }: { filters: Record<string, string> }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveScreen(name, filters); setMsg(r.ok ? 'Saved' : r.error ?? 'Failed'); if (r.ok) setName(''); }); }}>
      <input className="input py-1.5" placeholder="Name this screen" value={name} onChange={(e) => setName(e.target.value)} aria-label="Screen name" />
      <button className="btn-ghost btn-sm" disabled={pending || !name.trim()}>Save screen</button>
      {msg && <span role="status" className="self-center text-xs text-txt-soft">{msg}</span>}
    </form>
  );
}

export function DeleteScreen({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-txt-mute hover:text-down" disabled={pending} onClick={() => start(() => deleteScreen(id))} aria-label="Delete screen">✕</button>;
}
