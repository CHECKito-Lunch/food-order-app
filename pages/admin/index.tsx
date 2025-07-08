// pages/admin/index.tsx

import UsersTable     from '../components/Admin/UsersTable';
import WeekMenuEditor from '../components/Admin/WeekMenuEditor';
import OrdersTable    from '../components/Admin/OrdersTable';
import dayjs          from '../../lib/dayjs';

export default function Admin() {
  const today   = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

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
