import { bad, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { getTeamState } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  try {
    return ok({ team: { id: session.teamId, name: session.teamName }, ...(await getTeamState(session.teamId)) });
  } catch (error) {
    return bad(error instanceof Error ? error.message : 'Serverfehler.', 500);
  }
}
