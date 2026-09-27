'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT } from 'jose';
import { signingKey } from '@/lib/secret';
import { timingSafeEqual, createHash } from 'crypto';

const tries = new Map<string, { n: number; t: number }>();
export async function login(_: { error?: string } | undefined, form: FormData) {
  const pw = String(form.get('password') ?? '');
  const expected = process.env.APP_PASSWORD ?? '';
  const k = 'all'; const b = tries.get(k);
  if (b && b.n >= 8 && Date.now() - b.t < 15 * 60_000) return { error: 'Too many attempts. Wait 15 minutes.' };
  const h = (s: string) => createHash('sha256').update(s).digest();
  if (!expected || !timingSafeEqual(h(pw), h(expected))) { tries.set(k, { n: (b?.n ?? 0) + 1, t: Date.now() }); return { error: 'Wrong password.' }; }
  tries.delete(k);
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(await signingKey());
  cookies().set('c5_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 86400, path: '/' });
  redirect('/');
}
