import { questionBlocks } from './config';
import { supabaseAdmin } from './supabase-admin';

export type QuizTimerSettings = {
  enabled: boolean;
  durations: Record<string, number>;
};

export function defaultQuizTimerSettings(): QuizTimerSettings {
  return {
    enabled: true,
    durations: Object.fromEntries(questionBlocks.map((block) => [block.id, block.durationMinutes || 5])),
  };
}

export function normalizeQuizTimerSettings(value?: Partial<QuizTimerSettings> | null): QuizTimerSettings {
  const defaults = defaultQuizTimerSettings();
  const rawDurations = value?.durations ?? {};
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : defaults.enabled,
    durations: Object.fromEntries(questionBlocks.map((block) => {
      const raw = Number(rawDurations[block.id] ?? defaults.durations[block.id] ?? 5);
      const duration = Number.isFinite(raw) ? Math.min(180, Math.max(1, Math.round(raw))) : 5;
      return [block.id, duration];
    })),
  };
}

export async function getQuizTimerSettings(): Promise<QuizTimerSettings> {
  const { data, error } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'quiz_timer').maybeSingle();
  if (error) throw error;
  return normalizeQuizTimerSettings((data?.value as Partial<QuizTimerSettings> | null) ?? null);
}

export async function saveQuizTimerSettings(settings: QuizTimerSettings) {
  const normalized = normalizeQuizTimerSettings(settings);
  const db = supabaseAdmin();
  const { error } = await db.from('app_settings').upsert({
    key: 'quiz_timer',
    value: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
  return normalized;
}
