import { supabaseAdmin } from './supabase-admin';

export async function getDeadlineAt() {
  const { data, error } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'deadline').maybeSingle();
  if (error) throw error;
  const value = data?.value as { deadlineAt?: string | null } | null;
  return value?.deadlineAt ?? null;
}

export async function deadlinePassed() {
  const deadlineAt = await getDeadlineAt();
  return !!deadlineAt && Date.now() >= new Date(deadlineAt).getTime();
}
