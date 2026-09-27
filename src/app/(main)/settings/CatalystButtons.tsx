'use client';
import { useTransition } from 'react';
import { deleteCatalyst, resolveCatalyst } from '@/app/actions/user';

export function CatalystButtons({ id, security }: { id: number; security: boolean }) {
  const [p, start] = useTransition();
  return (
    <span className="inline-flex gap-3 text-xs">
      {security && <button className="text-txt-soft hover:text-up" disabled={p} onClick={() => start(() => resolveCatalyst(id))}>Mark resolved</button>}
      <button className="text-txt-mute hover:text-down" disabled={p} onClick={() => start(() => deleteCatalyst(id))}>Delete</button>
    </span>
  );
}
