import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '');
  const stationId = Number(body.stationId);
  const raw = body.scorePercent;
  const scorePercent = raw === '' || raw === null ? null : Number(raw);
  if (!teamId || !Number.isInteger(stationId) || (scorePercent !== null && (!Number.isInteger(scorePercent) || scorePercent < 0 || scorePercent > 100))) {
    return bad('Punkte müssen 0–100 sein.');
  }
  const { error } = await supabaseAdmin().from('station_progress').upsert({
    team_id: teamId,
    station_id: stationId,
    score_percent: scorePercent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_id,station_id' });
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
