import type { ScoringConfig } from './types';
import { mergeScoringConfig } from './config';
import { supabaseAdmin } from './supabase-admin';

export async function getScoringConfig(): Promise<ScoringConfig> {
  const { data, error } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'scoring').maybeSingle();
  if (error) throw error;
  return mergeScoringConfig((data?.value ?? null) as Partial<ScoringConfig> | null);
}

export async function saveScoringConfig(config: ScoringConfig) {
  const { error } = await supabaseAdmin().from('app_settings').upsert({
    key: 'scoring',
    value: config,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
}
