import { bad, ok } from '@/lib/http';
import { getQuizTimerSettings, normalizeQuizTimerSettings, saveQuizTimerSettings } from '@/lib/quiz-timer-settings';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  return ok({ quizTimer: await getQuizTimerSettings() });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const previous = await getQuizTimerSettings();
  const next = normalizeQuizTimerSettings({ enabled: body.enabled, durations: body.durations });
  const saved = await saveQuizTimerSettings(next);

  // Nach einem Wechsel AUS -> AN sollen alte, längst vergangene Startzeiten
  // nicht sofort wieder sperren. Alle Teams starten ihre Blöcke sauber neu.
  if (!previous.enabled && saved.enabled) {
    const { error } = await supabaseAdmin().from('quiz_block_progress').delete().neq('block_id', '__never__');
    if (error) return bad(error.message, 500);
  }

  return ok({ quizTimer: saved });
}
