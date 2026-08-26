import { getSession } from '@/lib/session';
import AdminApp from '@/components/AdminApp';

export default async function AdminPage() {
  const session = await getSession();
  return <AdminApp initiallyLoggedIn={session?.role === 'admin'} />;
}
