import { bad, ok } from '@/lib/http';
import { getMusicRoundSettings, normalizeMusicRoundSettings, saveMusicRoundSettings } from '@/lib/music-round-settings';
import { requireAdmin } from '@/lib/session';

export async function GET() {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  return ok({ musicRoundSettings: await getMusicRoundSettings() });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return bad('Nicht erlaubt.', 401);
  const body = await request.json().catch(() => ({}));
  const next = normalizeMusicRoundSettings({ stageDurationsSeconds: body.stageDurationsSeconds });
  const saved = await saveMusicRoundSettings(next);
  return ok({ musicRoundSettings: saved });
}
