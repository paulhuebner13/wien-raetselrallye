import { clearSession } from '@/lib/session';
import { ok } from '@/lib/http';

export async function POST() {
  await clearSession();
  return ok({ ok: true });
}
