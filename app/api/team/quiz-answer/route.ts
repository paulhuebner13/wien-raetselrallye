import { allQuestions, blockForQuestion } from '@/lib/config';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { blockExpired, blockIsUnlocked } from '@/lib/quiz-blocks';
import { getQuizTimerSettings } from '@/lib/quiz-timer-settings';
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

  const block = blockForQuestion(questionId);
  if (!block) return bad('Fragenblock nicht gefunden.', 500);
  if (!(await blockIsUnlocked(session.teamId, block.id))) return bad('Fragenblock noch gesperrt.', 403);

  const timer = await getQuizTimerSettings();
  const db = supabaseAdmin();

  if (timer.enabled) {
    const { data: progress, error: progressError } = await db
      .from('quiz_block_progress')
      .select('started_at')
      .eq('team_id', session.teamId)
      .eq('block_id', block.id)
      .maybeSingle();
    if (progressError) return bad(progressError.message, 500);
    if (!progress?.started_at) return bad('Fragenblock noch nicht gestartet.', 403);
    const durationMinutes = timer.durations[block.id] ?? block.durationMinutes ?? 5;
    if (blockExpired(progress.started_at, durationMinutes)) return bad('Zeit für diesen Fragenblock abgelaufen.', 403);
  }

  const { error } = await db.from('quiz_answers').upsert(
    { team_id: session.teamId, question_id: questionId, answer, updated_at: new Date().toISOString() },
    { onConflict: 'team_id,question_id' },
  );
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
