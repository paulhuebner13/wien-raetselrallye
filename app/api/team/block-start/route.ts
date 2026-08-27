import { questionBlocks } from '@/lib/config';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { blockExpiresAt, blockIsUnlocked } from '@/lib/quiz-blocks';
import { getQuizTimerSettings } from '@/lib/quiz-timer-settings';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);

  const body = await request.json().catch(() => ({}));
  const blockId = String(body.blockId ?? '');
  const block = questionBlocks.find((item) => item.id === blockId);
  if (!block) return bad('Fragenblock nicht gefunden.');
  if (!(await blockIsUnlocked(session.teamId, blockId))) return bad('Fragenblock noch gesperrt.', 403);

  const timer = await getQuizTimerSettings();
  if (!timer.enabled) return ok({ timerEnabled: false, startedAt: null, expiresAt: null });
  const durationMinutes = timer.durations[blockId] ?? block.durationMinutes ?? 5;

  const db = supabaseAdmin();
  const existing = await db.from('quiz_block_progress').select('started_at').eq('team_id', session.teamId).eq('block_id', blockId).maybeSingle();
  if (existing.error) return bad(existing.error.message, 500);
  if (existing.data?.started_at) {
    return ok({ timerEnabled: true, durationMinutes, startedAt: existing.data.started_at, expiresAt: blockExpiresAt(existing.data.started_at, durationMinutes) });
  }

  const startedAt = new Date().toISOString();
  const inserted = await db.from('quiz_block_progress').insert({ team_id: session.teamId, block_id: blockId, started_at: startedAt }).select('started_at').single();
  if (inserted.error) {
    const retry = await db.from('quiz_block_progress').select('started_at').eq('team_id', session.teamId).eq('block_id', blockId).maybeSingle();
    if (retry.data?.started_at) return ok({ timerEnabled: true, durationMinutes, startedAt: retry.data.started_at, expiresAt: blockExpiresAt(retry.data.started_at, durationMinutes) });
    return bad(inserted.error.message, 500);
  }
  return ok({ timerEnabled: true, durationMinutes, startedAt: inserted.data.started_at, expiresAt: blockExpiresAt(inserted.data.started_at, durationMinutes) });
}
