'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './ui';

const ITEMS = [['/', 'Dashboard'], ['/market', 'Market'], ['/daily', 'Daily 5'], ['/screener', 'Screener'], ['/watchlist', 'Watchlist'], ['/portfolio', 'Portfolio'], ['/history', 'History'], ['/settings', 'Settings']];

export function Nav({ unread }: { unread: number }) {
  const p = usePathname();
  return (
    <nav className="order-last -mx-1 flex w-full min-w-0 gap-0.5 overflow-x-auto pb-1 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:pb-0" aria-label="Main">
      {ITEMS.map(([h, l]) => {
        const active = h === '/' ? p === '/' : p.startsWith(h);
        return (
          <Link key={h} href={h} className={cn('relative whitespace-nowrap rounded px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]', active ? 'bg-amber-soft text-amber' : 'text-txt-soft hover:text-txt')}>
            {l}{h === '/watchlist' && unread > 0 && <span className="ml-1 rounded bg-down px-1 text-[9px] text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
