import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

const allowed = new Set(['question', 'station', 'guinness', 'architecture', 'beer']);

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '');
  const itemType = String(body.itemType ?? '');
  const itemId = String(body.itemId ?? '');
  const isValid = body.isValid === true;
  if (!teamId || !itemId || !allowed.has(itemType)) return bad('Ungültige Wertung.');
  const { error } = await supabaseAdmin().from('evaluations').upsert({
    team_id: teamId, item_type: itemType, item_id: itemId, is_valid: isValid, updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,item_type,item_id' });
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
