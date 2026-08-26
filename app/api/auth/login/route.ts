import { bad, ok } from '@/lib/http';
import { verifyPassword } from '@/lib/password';
import { setSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '');
  const password = String(body.password ?? '');
  if (!teamId || !password) return bad('Team und Passwort fehlen.');

  const { data, error } = await supabaseAdmin().from('teams').select('id,name,password_hash').eq('id', teamId).maybeSingle();
  if (error || !data || !verifyPassword(password, data.password_hash)) return bad('Falsches Passwort.', 401);

  await setSession({ role: 'team', teamId: data.id, teamName: data.name });
  return ok({ ok: true, team: { id: data.id, name: data.name } });
}
