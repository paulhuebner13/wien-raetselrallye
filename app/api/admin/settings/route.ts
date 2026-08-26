import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const { data, error } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'deadline').maybeSingle();
  if (error) return bad(error.message, 500);
  return ok({ deadlineAt: (data?.value as { deadlineAt?: string | null } | null)?.deadlineAt ?? null });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const raw = body.deadlineAt == null || body.deadlineAt === '' ? null : String(body.deadlineAt);
  if (raw && Number.isNaN(new Date(raw).getTime())) return bad('Zeitpunkt ungültig.');
  const { error } = await supabaseAdmin().from('app_settings').upsert({
    key: 'deadline', value: { deadlineAt: raw }, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) return bad(error.message, 500);
  return ok({ deadlineAt: raw });
}
