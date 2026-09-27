'use client';
import { useTransition } from 'react';
import { deleteHolding } from '@/app/actions/user';

export function DeleteHolding({ id }: { id: number }) {
  const [p, start] = useTransition();
  return <button className="text-xs text-txt-mute hover:text-down" disabled={p} onClick={() => start(() => deleteHolding(id))}>Remove</button>;
}
