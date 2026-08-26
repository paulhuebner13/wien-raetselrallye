import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const slot = Number(body.slot);
  const path = String(body.path ?? '');
  if (!Number.isInteger(slot) || slot < 1 || slot > 8 || !path.startsWith(`picture-round/${slot}-`)) return bad('Ungültige Daten.');
  const db = supabaseAdmin();
  const { data: old } = await db.from('picture_round_images').select('storage_path').eq('slot', slot).maybeSingle();
  const { error } = await db.from('picture_round_images').upsert({ slot, storage_path: path, updated_at: new Date().toISOString() }, { onConflict: 'slot' });
  if (error) { await db.storage.from('quiz-assets').remove([path]); return bad(error.message, 500); }
  if (old?.storage_path && old.storage_path !== path) await db.storage.from('quiz-assets').remove([old.storage_path]);
  return ok({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const { slot } = await request.json().catch(() => ({}));
  const id = Number(slot);
  const db = supabaseAdmin();
  const { data } = await db.from('picture_round_images').select('storage_path').eq('slot', id).maybeSingle();
  if (data?.storage_path) await db.storage.from('quiz-assets').remove([data.storage_path]);
  const { error } = await db.from('picture_round_images').delete().eq('slot', id);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
