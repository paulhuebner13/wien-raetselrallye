import { supabaseAdmin } from '@/lib/supabase-admin';
import { ok } from '@/lib/http';

export async function GET() {
  const { data, error } = await supabaseAdmin().from('teams').select('id,name').order('name');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return ok({ teams: data ?? [] });
}
