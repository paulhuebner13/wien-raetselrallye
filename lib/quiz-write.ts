import { allQuestions, blockForQuestion } from './config';
import { deadlinePassed } from './deadline';
import { blockExpired, blockIsUnlocked } from './quiz-blocks';
import { getQuizTimerSettings } from './quiz-timer-settings';
import { supabaseAdmin } from './supabase-admin';

export async function quizWriteError(teamId: string, questionId: string) {
  if (await deadlinePassed()) return 'Zeit abgelaufen.';
  if (!allQuestions().some((q) => q.id === questionId)) return 'Frage nicht gefunden.';
  const block = blockForQuestion(questionId);
  if (!block) return 'Fragenblock nicht gefunden.';
  if (!(await blockIsUnlocked(teamId, block.id))) return 'Fragenblock noch gesperrt.';
  const timer = await getQuizTimerSettings();
  if (!timer.enabled) return null;
  const { data, error } = await supabaseAdmin().from('quiz_block_progress').select('started_at').eq('team_id', teamId).eq('block_id', block.id).maybeSingle();
  if (error) throw error;
  if (!data?.started_at) return 'Fragenblock noch nicht gestartet.';
  const durationMinutes = timer.durations[block.id] ?? block.durationMinutes ?? 5;
  if (blockExpired(data.started_at, durationMinutes)) return 'Zeit für diesen Fragenblock abgelaufen.';
  return null;
}
