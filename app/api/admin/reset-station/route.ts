import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '');
  const stationId = Number(body.stationId);
  if (!teamId || !Number.isInteger(stationId)) return bad('Ungültige Daten.');

  const { error } = await supabaseAdmin().from('station_progress').upsert({
    team_id: teamId,
    station_id: stationId,
    answer: null,
    submitted_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,station_id' });
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
