import { randomUUID } from 'crypto';
import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const slot = Number(body.slot);
  const fileName = String(body.fileName ?? 'image.jpg');
  const contentType = String(body.contentType ?? 'image/jpeg');
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) return bad('Bildnummer ungültig.');
  if (!contentType.startsWith('image/')) return bad('Nur Bilder erlaubt.');
  const ext = fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  const path = `picture-round/${slot}-${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from('quiz-assets').createSignedUploadUrl(path);
  if (error || !data) return bad(error?.message ?? 'Upload konnte nicht vorbereitet werden.', 500);
  return ok({ path, token: data.token });
}
