import { supabaseAdmin } from './supabase-admin';
import { rallyeConfig } from './config';
import { getScoringConfig } from './scoring-settings';
import { getDeadlineAt } from './deadline';
import { getTeamStationOrder } from './team-order';

export async function getTeamState(teamId: string) {
  const db = supabaseAdmin();
  const [progressRes, quizRes, beerRes, guinnessRes, architectureRes, deadlineAt, stationOrder, scoring] = await Promise.all([
    db.from('station_progress').select('*').eq('team_id', teamId),
    db.from('quiz_answers').select('*').eq('team_id', teamId),
    db.from('beers').select('*').eq('team_id', teamId).order('brand'),
    db.from('guinness_entries').select('*').eq('team_id', teamId).order('created_at'),
    db.from('architecture_entries').select('*').eq('team_id', teamId).order('created_at'),
    getDeadlineAt(),
    getTeamStationOrder(teamId),
    getScoringConfig(),
  ]);

  for (const result of [progressRes, quizRes, beerRes, guinnessRes, architectureRes]) {
    if (result.error) throw result.error;
  }

  const signTeam = async (path?: string | null) => {
    if (!path) return null;
    const { data } = await db.storage.from('team-uploads').createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  };

  const beers = await Promise.all((beerRes.data ?? []).map(async (entry) => ({ ...entry, image_url: await signTeam(entry.storage_path) })));
  const guinness = await Promise.all((guinnessRes.data ?? []).map(async (entry) => ({ ...entry, image_url: await signTeam(entry.storage_path) })));
  const architecture = await Promise.all((architectureRes.data ?? []).map(async (entry) => ({ ...entry, image_url: await signTeam(entry.storage_path) })));

  const progress = Object.fromEntries((progressRes.data ?? []).map((p) => [p.station_id, p]));
  const quiz = Object.fromEntries((quizRes.data ?? []).map((q) => [q.question_id, q.answer]));

  const stationStates = stationOrder.map((stationId, index) => {
    const row = progress[stationId];
    const previous = index === 0 ? true : !!progress[stationOrder[index - 1]]?.submitted_at;
    return {
      stationId,
      unlocked: previous,
      submitted: !!row?.submitted_at,
      hintsUsed: row?.hints_used ?? 0,
      hintPoints: Math.max(0, scoring.hintPointsMax - (row?.hints_used ?? 0)),
      answer: row?.answer ?? '',
      submittedAt: row?.submitted_at ?? null,
      scorePercent: row?.score_percent ?? null,
    };
  });

  const locked = !!deadlineAt && Date.now() >= new Date(deadlineAt).getTime();
  return {
    stationOrder,
    stationStates,
    quiz,
    beers,
    guinness,
    architecture,
    deadlineAt,
    locked,
    finalStationTitle: rallyeConfig.finish.title,
    reviewUnlocked: stationStates.every((s) => s.submitted),
    scoring,
  };
}
