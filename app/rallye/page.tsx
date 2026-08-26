import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { rallyeConfig, questionBlocks } from '@/lib/config';
import RallyeApp from '@/components/RallyeApp';

export default async function RallyePage() {
  const session = await getSession();
  if (!session || session.role !== 'team') redirect('/');
  return <RallyeApp config={rallyeConfig} blocks={questionBlocks} teamName={session.teamName} />;
}
