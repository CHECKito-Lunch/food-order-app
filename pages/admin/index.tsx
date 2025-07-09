import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import UsersTable     from '../components/Admin/UsersTable';
import WeekMenuEditor from '../components/Admin/WeekMenuEditor';
import OrdersTable    from '../components/Admin/OrdersTable';
import dayjs          from '../../lib/dayjs';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      if (!sessionUser) {
        router.push('/login');
        return;
      }
      // NEU: Adminrolle im Metadata prüfen!
      if (sessionUser.user_metadata?.role !== 'admin') {
        alert('Kein Admin-Zugang!');
        router.push('/');
        return;
      }
      setUser(sessionUser);
      setLoading(false);
    });
  }, [router]);

  const today   = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  if (loading) return <div>Lädt...</div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-10">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <UsersTable />
      <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />
      <OrdersTable />
    </div>
  );
}
