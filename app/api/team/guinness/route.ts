import { deadlinePassed } from '@/lib/deadline';
import { bad, normalize, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const street = String(body.street ?? '').trim();
  const path = String(body.path ?? '');
  if (!street || !path.startsWith(`${session.teamId}/guinness/`)) return bad('Ungültige Daten.');

  const db = supabaseAdmin();
  const insert = await db.from('guinness_entries').insert({
    team_id: session.teamId,
    street,
    street_normalized: normalize(street),
    storage_path: path,
  }).select('*').single();
  if (insert.error) {
    await db.storage.from('team-uploads').remove([path]);
    return bad(insert.error.code === '23505' ? 'Diese Straße wurde schon verwendet.' : insert.error.message);
  }
  return ok({ entry: insert.data });
}

export async function DELETE(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const { id } = await request.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data } = await db.from('guinness_entries').select('storage_path').eq('id', String(id)).eq('team_id', session.teamId).maybeSingle();
  if (!data) return bad('Eintrag nicht gefunden.', 404);
  await db.storage.from('team-uploads').remove([data.storage_path]);
  const { error } = await db.from('guinness_entries').delete().eq('id', String(id)).eq('team_id', session.teamId);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
