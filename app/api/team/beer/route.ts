import { deadlinePassed } from '@/lib/deadline';
import { bad, normalizeBeer, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const brand = String(body.brand ?? '').trim();
  const path = String(body.path ?? '');
  if (!brand || !path.startsWith(`${session.teamId}/beer/`)) return bad('Foto und Bier fehlen.');
  const db = supabaseAdmin();
  const { data, error } = await db.from('beers').insert({
    team_id: session.teamId,
    brand,
    brand_normalized: normalizeBeer(brand),
    storage_path: path,
  }).select('*').single();
  if (error) {
    await db.storage.from('team-uploads').remove([path]);
    return bad(error.code === '23505' ? 'Dieses Bier zählt schon.' : error.message);
  }
  return ok({ beer: data });
}

export async function DELETE(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const { id } = await request.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data } = await db.from('beers').select('storage_path').eq('id', String(id)).eq('team_id', session.teamId).maybeSingle();
  if (!data) return bad('Eintrag nicht gefunden.', 404);
  if (data.storage_path) await db.storage.from('team-uploads').remove([data.storage_path]);
  const { error } = await db.from('beers').delete().eq('id', String(id)).eq('team_id', session.teamId);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
