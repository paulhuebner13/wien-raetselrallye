import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeadlineAt } from '@/lib/deadline';

export async function GET() {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const db = supabaseAdmin();
  const [teams, progress, quiz, beers, guinness, architecture, evaluations, deadlineAt] = await Promise.all([
    db.from('teams').select('id,name,station_order,created_at').order('name'),
    db.from('station_progress').select('*').order('station_id'),
    db.from('quiz_answers').select('*').order('question_id'),
    db.from('beers').select('*').order('brand'),
    db.from('guinness_entries').select('*').order('created_at'),
    db.from('architecture_entries').select('*').order('created_at'),
    db.from('evaluations').select('*'),
    getDeadlineAt(),
  ]);
  const anyError = [teams, progress, quiz, beers, guinness, architecture, evaluations].find((r) => r.error)?.error;
  if (anyError) return bad(anyError.message, 500);
  const signTeam = async (path?: string | null) => {
    if (!path) return null;
    const { data } = await db.storage.from('team-uploads').createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  };
  const beersSigned = await Promise.all((beers.data ?? []).map(async (x) => ({ ...x, image_url: await signTeam(x.storage_path) })));
  const guinnessSigned = await Promise.all((guinness.data ?? []).map(async (x) => ({ ...x, image_url: await signTeam(x.storage_path) })));
  const architectureSigned = await Promise.all((architecture.data ?? []).map(async (x) => ({ ...x, image_url: await signTeam(x.storage_path) })));
  return ok({ teams: teams.data ?? [], progress: progress.data ?? [], quiz: quiz.data ?? [], beers: beersSigned, guinness: guinnessSigned, architecture: architectureSigned, evaluations: evaluations.data ?? [], deadlineAt });
}
