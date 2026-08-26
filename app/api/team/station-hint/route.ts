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
  const { stationId } = await request.json().catch(() => ({}));
  const id = Number(stationId);
  const station = rallyeConfig.stations.find((s) => s.id === id);
  if (!station) return bad('Station nicht gefunden.');

  const db = supabaseAdmin();
  const order = await getTeamStationOrder(session.teamId);
  const stationIndex = order.indexOf(id);
  if (stationIndex < 0) return bad('Station nicht gefunden.');
  if (stationIndex > 0) {
    const previousId = order[stationIndex - 1];
    const { data: previous } = await db.from('station_progress').select('submitted_at').eq('team_id', session.teamId).eq('station_id', previousId).maybeSingle();
    if (!previous?.submitted_at) return bad('Station noch gesperrt.', 403);
  }
  const { data: current } = await db.from('station_progress').select('hints_used,submitted_at').eq('team_id', session.teamId).eq('station_id', id).maybeSingle();
  if (current?.submitted_at) return bad('Station ist abgeschlossen.');
  const hintsUsed = Math.min(5, (current?.hints_used ?? 0) + 1);
  const { error } = await db.from('station_progress').upsert({ team_id: session.teamId, station_id: id, hints_used: hintsUsed, updated_at: new Date().toISOString() }, { onConflict: 'team_id,station_id' });
  if (error) return bad(error.message, 500);
  return ok({ hintsUsed, hintPoints: Math.max(0, 5 - hintsUsed) });
}
