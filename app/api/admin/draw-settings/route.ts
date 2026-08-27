import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const playerText = String(body.playerText ?? '').slice(0, 20000);
  const teamCount = Math.max(2, Math.min(50, Number(body.teamCount) || 2));
  const constraints = Array.isArray(body.constraints) ? body.constraints.slice(0, 500) : [];
  const drawResult = Array.isArray(body.drawResult) ? body.drawResult.slice(0, 50) : null;
  const value = { playerText, teamCount, constraints, drawResult };
  const { error } = await supabaseAdmin().from('app_settings').upsert({
    key: 'team_draw', value, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) return bad(error.message, 500);
  return ok({ saved: true });
}
