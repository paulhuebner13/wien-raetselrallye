import { distributeBlocks, questionBlocks } from './config';
import { supabaseAdmin } from './supabase-admin';
import { getTeamStationOrder } from './team-order';

export function blockExpiresAt(startedAt: string, durationMinutes: number) {
  return new Date(new Date(startedAt).getTime() + durationMinutes * 60_000).toISOString();
}

export function blockExpired(startedAt: string, durationMinutes: number, now = Date.now()) {
  return now >= new Date(startedAt).getTime() + durationMinutes * 60_000;
}

export async function getQuizBlockRows(teamId: string) {
  const { data, error } = await supabaseAdmin().from('quiz_block_progress').select('*').eq('team_id', teamId);
  if (error) throw error;
  return data ?? [];
}

export async function blockIsUnlocked(teamId: string, blockId: string) {
  const order = await getTeamStationOrder(teamId);
  const grouped = distributeBlocks(questionBlocks, order.length);
  const slot = grouped.findIndex((blocks) => blocks.some((block) => block.id === blockId));
  if (slot < 0) return false;
  const stationId = order[slot];
  const { data, error } = await supabaseAdmin()
    .from('station_progress')
    .select('submitted_at')
    .eq('team_id', teamId)
    .eq('station_id', stationId)
    .maybeSingle();
  if (error) throw error;
  return !!data?.submitted_at;
}
