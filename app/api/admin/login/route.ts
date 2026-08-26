import { bad, ok } from '@/lib/http';
import { setSession } from '@/lib/session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? '');
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) return bad('Falsches Passwort.', 401);
  await setSession({ role: 'admin' });
  return ok({ ok: true });
}
