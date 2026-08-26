import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LoginForm from '@/components/LoginForm';

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === 'team') redirect('/rallye');
  return <LoginForm />;
}
