import { rallyeConfig } from './config';
import { supabaseAdmin } from './supabase-admin';

export function defaultStationOrder() {
  const finalId = rallyeConfig.finalStationId;
  return [...rallyeConfig.stations.filter((s) => s.id !== finalId).map((s) => s.id), finalId];
}

export function validateStationOrder(order: number[]) {
  const ids = rallyeConfig.stations.map((s) => s.id);
  return order.length === ids.length
    && new Set(order).size === ids.length
    && ids.every((id) => order.includes(id))
    && order[order.length - 1] === rallyeConfig.finalStationId;
}

export async function getTeamStationOrder(teamId: string) {
  const { data, error } = await supabaseAdmin().from('teams').select('station_order').eq('id', teamId).maybeSingle();
  if (error) throw error;
  const raw = Array.isArray(data?.station_order) ? data.station_order.map(Number) : [];
  return validateStationOrder(raw) ? raw : defaultStationOrder();
}
