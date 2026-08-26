import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export type Session =
  | { role: 'team'; teamId: string; teamName: string }
  | { role: 'admin' };

const COOKIE = 'rallye_session';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(value?: string): Session | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return decode(store.get(COOKIE)?.value);
}

export async function setSession(session: Session) {
  const store = await cookies();
  store.set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 18,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function requireTeam() {
  const session = await getSession();
  if (!session || session.role !== 'team') return null;
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  return !!session && session.role === 'admin';
}
