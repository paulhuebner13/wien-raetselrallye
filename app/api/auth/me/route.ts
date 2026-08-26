import { getSession } from '@/lib/session';
import { ok } from '@/lib/http';

export async function GET() {
  return ok({ session: await getSession() });
}
