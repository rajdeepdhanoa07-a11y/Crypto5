import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { signingKey } from '@/lib/secret';

// If APP_PASSWORD is set, the whole app (except the cron endpoint) needs a login.
export async function middleware(req: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();
  const p = req.nextUrl.pathname;
  if (p.startsWith('/login') || p.startsWith('/api/cron') || p.startsWith('/_next') || p === '/favicon.ico') return NextResponse.next();
  const token = req.cookies.get('c5_session')?.value;
  if (token) {
    try { await jwtVerify(token, await signingKey()); return NextResponse.next(); } catch { /* fall through */ }
  }
  if (p.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
  return NextResponse.redirect(url);
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
