// pages/admin/index.tsx

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
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null;
      if (!sessionUser) {
        router.push('/login');
        return;
      }
      // Rolle prüfen
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sessionUser.id)
        .single();

      if (profile?.role !== 'admin') {
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

      {/* User Management */}
      <UsersTable />

      {/* Wochen-Menü Editor */}
      <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />

      {/* Bestell-Übersicht */}
      <OrdersTable />
    </div>
  );
}
