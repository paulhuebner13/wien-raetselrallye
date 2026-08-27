import { bad, ok } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { mergeScoringConfig } from '@/lib/config';
import { saveScoringConfig } from '@/lib/scoring-settings';
import type { ScoringConfig } from '@/lib/types';

function nonNegative(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({})) as Partial<ScoringConfig>;
  const merged = mergeScoringConfig(body);
  const config: ScoringConfig = {
    ...merged,
    hintPointsMax: nonNegative(merged.hintPointsMax, 5),
    stationTaskDefault: nonNegative(merged.stationTaskDefault, 5),
    stationTaskPoints: Object.fromEntries(Object.entries(merged.stationTaskPoints).map(([k, v]) => [k, nonNegative(v, merged.stationTaskDefault)])),
    questionDefault: nonNegative(merged.questionDefault, 1),
    questionPoints: Object.fromEntries(Object.entries(merged.questionPoints).map(([k, v]) => [k, nonNegative(v, merged.questionDefault)])),
    pictureRoundPartialThreshold: Math.max(1, Math.min(8, Math.round(nonNegative(merged.pictureRoundPartialThreshold, 4)))),
    pictureRoundPartialPoints: nonNegative(merged.pictureRoundPartialPoints, 1),
    pictureRoundFullPoints: nonNegative(merged.pictureRoundFullPoints, 2),
    musicRoundPerCorrect: nonNegative(merged.musicRoundPerCorrect, 1),
    musicRoundStagePoints: Array.from({ length: 4 }, (_, i) => nonNegative(merged.musicRoundStagePoints?.[i], [2, 1.5, 1, 0.5][i])) as [number, number, number, number],
    guinnessPerLogo: nonNegative(merged.guinnessPerLogo, 3),
    architecturePerStyle: nonNegative(merged.architecturePerStyle, 1),
    beerPerUniqueCan: nonNegative(merged.beerPerUniqueCan, 1),
  };
  try {
    await saveScoringConfig(config);
    return ok({ scoring: config });
  } catch (error) {
    return bad(error instanceof Error ? error.message : 'Fehler.', 500);
  }
}
