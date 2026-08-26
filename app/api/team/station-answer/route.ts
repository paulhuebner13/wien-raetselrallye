import { rallyeConfig } from '@/lib/config';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeamStationOrder } from '@/lib/team-order';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const stationId = Number(body.stationId);
  const answer = String(body.answer ?? '').trim();
  if (!rallyeConfig.stations.some((s) => s.id === stationId) || !answer) return bad('Antwort fehlt.');

  const db = supabaseAdmin();
  const order = await getTeamStationOrder(session.teamId);
  const index = order.indexOf(stationId);
  if (index < 0) return bad('Station nicht gefunden.');
  if (index > 0) {
    const previousId = order[index - 1];
    const { data: previous } = await db.from('station_progress').select('submitted_at').eq('team_id', session.teamId).eq('station_id', previousId).maybeSingle();
    if (!previous?.submitted_at) return bad('Station noch gesperrt.', 403);
  }

  const { data: current } = await db.from('station_progress').select('submitted_at,hints_used').eq('team_id', session.teamId).eq('station_id', stationId).maybeSingle();
  if (current?.submitted_at) return bad('Antwort ist bereits fix.', 409);
  const now = new Date().toISOString();
  const { error } = await db.from('station_progress').upsert({ team_id: session.teamId, station_id: stationId, answer, hints_used: current?.hints_used ?? 0, submitted_at: now, updated_at: now }, { onConflict: 'team_id,station_id' });
  if (error) return bad(error.message, 500);
  return ok({ ok: true, submittedAt: now });
}
