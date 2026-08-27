import { supabaseAdmin } from './supabase-admin';

export type MusicRoundSettings = {
  stageDurationsSeconds: [number, number, number, number];
};

export function defaultMusicRoundSettings(): MusicRoundSettings {
  return { stageDurationsSeconds: [2, 5, 10, 20] };
}

export function normalizeMusicRoundSettings(value?: Partial<MusicRoundSettings> | null): MusicRoundSettings {
  const defaults = defaultMusicRoundSettings().stageDurationsSeconds;
  const raw = Array.isArray(value?.stageDurationsSeconds) ? value!.stageDurationsSeconds! : defaults;
  const next: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const n = Number(raw[i] ?? defaults[i]);
    const min = i === 0 ? 0.5 : next[i - 1] + 0.5;
    next.push(Number.isFinite(n) ? Math.min(120, Math.max(min, Math.round(n * 10) / 10)) : defaults[i]);
  }
  return { stageDurationsSeconds: next as [number, number, number, number] };
}

export async function getMusicRoundSettings(): Promise<MusicRoundSettings> {
  const { data, error } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'music_round').maybeSingle();
  if (error) throw error;
  return normalizeMusicRoundSettings((data?.value as Partial<MusicRoundSettings> | null) ?? null);
}

export async function saveMusicRoundSettings(settings: MusicRoundSettings) {
  const normalized = normalizeMusicRoundSettings(settings);
  const { error } = await supabaseAdmin().from('app_settings').upsert({
    key: 'music_round',
    value: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
  return normalized;
}
