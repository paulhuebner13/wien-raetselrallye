import { allQuestions } from '@/lib/config';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const questionId = String(body.questionId ?? '');
  const answer = String(body.answer ?? '');
  if (!allQuestions().some((q) => q.id === questionId)) return bad('Frage nicht gefunden.');
  const { error } = await supabaseAdmin().from('quiz_answers').upsert({ team_id: session.teamId, question_id: questionId, answer, updated_at: new Date().toISOString() }, { onConflict: 'team_id,question_id' });
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
