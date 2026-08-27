import { allQuestions } from '@/lib/config';
import { bad, ok } from '@/lib/http';
import { parseMusicAnswer, serializeMusicAnswer } from '@/lib/music-answer';
import { quizWriteError } from '@/lib/quiz-write';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  const body = await request.json().catch(() => ({}));
  const questionId = String(body.questionId ?? '');
  const question = allQuestions().find((q) => q.id === questionId && q.type === 'music_round');
  if (!question) return bad('Music Round nicht gefunden.');
  const count = question.tracks?.length ?? 0;
  const incoming = parseMusicAnswer(JSON.stringify(body.music ?? {}), count);
  const blocked = await quizWriteError(session.teamId, questionId);
  if (blocked) return bad(blocked, 403);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('quiz_answers')
    .select('answer')
    .eq('team_id', session.teamId)
    .eq('question_id', questionId)
    .maybeSingle();
  if (error) return bad(error.message, 500);

  const existing = parseMusicAnswer(data?.answer, count);
  const merged = {
    answers: incoming.answers,
    stages: incoming.stages.map((stage, i) => Math.max(stage, existing.stages[i] ?? 1)),
  };
  const { error: saveError } = await db.from('quiz_answers').upsert(
    {
      team_id: session.teamId,
      question_id: questionId,
      answer: serializeMusicAnswer(merged),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'team_id,question_id' },
  );
  if (saveError) return bad(saveError.message, 500);
  return ok({ music: merged });
}
