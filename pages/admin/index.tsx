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

  // Navigation State: "users" | "menu" | "orders"
  const [activeTab, setActiveTab] = useState<"users" | "menu" | "orders">("users");

  // Kalenderwoche/Jahr auswählbar
  const today = dayjs();
  const [isoYear, setIsoYear] = useState(today.year());
  const [isoWeek, setIsoWeek] = useState(today.week());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      if (!sessionUser) {
        router.push('/login');
        return;
      }
      if (sessionUser.user_metadata?.role !== 'admin') {
        alert('Kein Admin-Zugang!');
        router.push('/');
        return;
      }
      setUser(sessionUser);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <div className="h-screen flex items-center justify-center text-lg dark:bg-gray-900 dark:text-gray-100">Lädt...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto mt-10 px-2 md:px-0">
        {/* Header */}
        <div className="rounded-2xl shadow-md border border-blue-100 dark:border-gray-700 mb-8 p-4 md:p-6 bg-white dark:bg-gray-800 flex flex-col gap-3 md:gap-0 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0056b3] dark:text-blue-200 mb-2 md:mb-0 tracking-tight">
            Admin Dashboard
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`text-sm px-3 py-1.5 rounded-full font-semibold transition ${
                activeTab === "users"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              Userverwaltung
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`text-sm px-3 py-1.5 rounded-full font-semibold transition ${
                activeTab === "menu"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              Wochen-Menü Editor
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`text-sm px-3 py-1.5 rounded-full font-semibold transition ${
                activeTab === "orders"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              Bestellübersicht
            </button>
          </div>
        </div>

        {/* Kalenderwoche-Auswahl nur für Menü/Orders */}
        {activeTab !== "users" && (
          <div className="flex flex-wrap gap-4 items-center mb-6 bg-blue-50 dark:bg-gray-800 p-3 rounded-xl border border-blue-100 dark:border-gray-700 shadow-inner">
            <label className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
              Jahr:
              <input
                type="number"
                value={isoYear}
                onChange={e => setIsoYear(Number(e.target.value))}
                className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
              KW:
              <input
                type="number"
                min={1}
                max={53}
                value={isoWeek}
                onChange={e => setIsoWeek(Number(e.target.value))}
                className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-16 focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              />
            </label>
          </div>
        )}

        {/* TAB INHALTE */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
          {activeTab === "users" && <UsersTable />}
          {activeTab === "menu" && <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />}
          {activeTab === "orders" && <OrdersTable isoYear={isoYear} isoWeek={isoWeek} />}
        </div>
      </div>
      <div className="mt-10 text-xs text-gray-400 dark:text-gray-600 mb-4">© {new Date().getFullYear()} CHECKito Lunch</div>
    </div>
  );
}
