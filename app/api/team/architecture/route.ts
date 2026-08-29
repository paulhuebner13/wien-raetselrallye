import { randomUUID } from 'crypto';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const drinkType = String(body.drinkType ?? '').trim();
  const drinker = String(body.drinker ?? '').trim();
  const storagePath = String(body.path ?? '');
  if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType) || !storagePath.startsWith(`${session.teamId}/architecture/`)) return bad('Ungültige Daten.');

  const db = supabaseAdmin();
  const style = `drink:${drinkType}:${randomUUID()}`;
  const insert = await db.from('architecture_entries').insert({
    team_id: session.teamId,
    style,
    building_name: drinker,
    storage_path: storagePath,
  }).select('*').single();

  if (insert.error) {
    await db.storage.from('team-uploads').remove([storagePath]);
    return bad(insert.error.message);
  }
  return ok({ entry: insert.data });
}

export async function DELETE(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const { id } = await request.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data } = await db.from('architecture_entries').select('storage_path,style').eq('id', String(id)).eq('team_id', session.teamId).maybeSingle();
  if (!data || !String(data.style).startsWith('drink:')) return bad('Eintrag nicht gefunden.', 404);
  await db.storage.from('team-uploads').remove([data.storage_path]);
  const { error } = await db.from('architecture_entries').delete().eq('id', String(id)).eq('team_id', session.teamId);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
