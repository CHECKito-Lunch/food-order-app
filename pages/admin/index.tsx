import UsersTable from '../../components/Admin/UsersTable';
import WeekMenuEditor from '../../components/Admin/WeekMenuEditor';
import OrdersTable from '../../components/Admin/OrdersTable';
import dayjs from 'dayjs';

export default function Admin() {
  const today = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-10">
      <h1 className="text-3xl">Admin Dashboard</h1>
      <UsersTable />
      <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />
      <OrdersTable />
    </div>
  );
}
