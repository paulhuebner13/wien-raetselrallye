import { randomUUID } from 'crypto';
import { deadlinePassed } from '@/lib/deadline';
import { bad, normalize, normalizeBeer, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind ?? '');
  const fileName = String(body.fileName ?? 'image.jpg');
  const contentType = String(body.contentType ?? 'image/jpeg');
  if (!contentType.startsWith('image/')) return bad('Nur Bilder erlaubt.');

  const db = supabaseAdmin();
  let folder = '';
  if (kind === 'guinness') {
    const street = String(body.street ?? '').trim();
    if (!street) return bad('Straße fehlt.');
    const { data: duplicate } = await db.from('guinness_entries').select('id').eq('team_id', session.teamId).eq('street_normalized', normalize(street)).maybeSingle();
    if (duplicate) return bad('Diese Straße wurde schon verwendet.');
    folder = 'guinness';
  } else if (kind === 'architecture') {
    const drinkType = String(body.drinkType ?? '').trim();
    const drinker = String(body.drinker ?? '').trim();
    if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType)) return bad('Getränk oder Name fehlt.');
    folder = 'architecture';
  } else if (kind === 'beer') {
    const brand = String(body.brand ?? '').trim();
    if (!brand) return bad('Bier fehlt.');
    const normalized = normalizeBeer(brand);
    const { data: existing } = await db.from('beers').select('id').eq('team_id', session.teamId).eq('brand_normalized', normalized).maybeSingle();
    if (existing) return bad('Dieses Bier zählt schon.');
    folder = 'beer';
  } else {
    return bad('Upload-Typ ungültig.');
  }

  const ext = fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  const path = `${session.teamId}/${folder}/${randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from('team-uploads').createSignedUploadUrl(path);
  if (error || !data) return bad(error?.message ?? 'Upload konnte nicht vorbereitet werden.', 500);
  return ok({ path, token: data.token });
}
