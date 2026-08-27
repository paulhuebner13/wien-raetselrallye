import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateStationOrder } from '@/lib/team-order';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '');
  const order = Array.isArray(body.stationOrder) ? body.stationOrder.map(Number) : [];
  if (!teamId || !validateStationOrder(order)) return bad('Reihenfolge ungültig. Jede Station muss genau einmal vorkommen.');
  const { error } = await supabaseAdmin().from('teams').update({ station_order: order }).eq('id', teamId);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
