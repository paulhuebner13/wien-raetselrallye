import { bad, ok } from '@/lib/http';
import { hashPassword } from '@/lib/password';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { defaultStationOrder } from '@/lib/team-order';

export async function GET() {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const { data, error } = await supabaseAdmin().from('teams').select('id,name,station_order,created_at').order('name');
  if (error) return bad(error.message, 500);
  return ok({ teams: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  if (!name || password.length < 4) return bad('Name und Passwort (mind. 4 Zeichen) angeben.');
  const { data, error } = await supabaseAdmin().from('teams').insert({ name, password_hash: hashPassword(password), station_order: defaultStationOrder() }).select('id,name,station_order,created_at').single();
  if (error) return bad(error.code === '23505' ? 'Team existiert schon.' : error.message);
  return ok({ team: data });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id) return bad('Team fehlt.');
  const db = supabaseAdmin();
  const [{ data: guinness }, { data: architecture }, { data: beers }] = await Promise.all([
    db.from('guinness_entries').select('storage_path').eq('team_id', id),
    db.from('architecture_entries').select('storage_path').eq('team_id', id),
    db.from('beers').select('storage_path').eq('team_id', id),
  ]);
  const paths = [...(guinness ?? []), ...(architecture ?? []), ...(beers ?? [])].map((x) => x.storage_path).filter(Boolean) as string[];
  if (paths.length) await db.storage.from('team-uploads').remove(paths);
  const { error } = await db.from('teams').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
