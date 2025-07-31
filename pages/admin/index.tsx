import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import UsersTable     from '../../components/Admin/UsersTable';
import WeekMenuEditor from '../../components/Admin/WeekMenuEditor';
import OrdersTable    from '../../components/Admin/OrdersTable';
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
      <div className="w-full max-w-screen-2xl mx-auto mt-6 px-4 md:px-6">
        {/* Header */}
        <div className="rounded-2xl shadow-md border border-blue-100 dark:border-gray-700 mb-8 p-3 md:p-4 bg-white dark:bg-gray-800 flex flex-col gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-[#0056b3] dark:text-blue-200 mb-2 tracking-tight">
            Admin Dashboard
          </h1>
          {/* Zur Useransicht Button */}
          <button
            onClick={() => router.push('/index')}
            className="flex items-center justify-center gap-2 text-xs px-2.5 py-1.5 rounded-full font-semibold bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600 shadow transition w-full"
            title="Zur Useransicht"
          >
            {/* Männchen Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 20 20" className="inline-block">
              <circle cx="10" cy="6" r="3" fill="currentColor"/>
              <path d="M3 17c0-2.76 3.134-5 7-5s7 2.24 7 5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            Zur Useransicht
          </button>
          {/* Tab Buttons - einzeln untereinander, mit Icons */}
          <div className="flex flex-col gap-2 mt-2 w-full">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full font-semibold transition w-full ${
                activeTab === "users"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              {/* User Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 20 20">
                <circle cx="10" cy="7" r="4" fill="currentColor" />
                <path d="M4 17c0-2.5 2.5-5 6-5s6 2.5 6 5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              </svg>
              Userverwaltung
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full font-semibold transition w-full ${
                activeTab === "menu"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              {/* Pencil / Menü Editor Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 20 20">
                <path d="M15.85 7.6l-3.45-3.45a1 1 0 0 0-1.4 0l-7 7V16h4.85l7-7a1 1 0 0 0 0-1.4z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                <path d="M13.5 3.5l3 3" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Menü Editor
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full font-semibold transition w-full ${
                activeTab === "orders"
                  ? "bg-[#0056b3] text-white shadow"
                  : "bg-blue-100 text-[#0056b3] hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-100 dark:hover:bg-gray-600"
              }`}
            >
              {/* Clipboard/Orders Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 20 20">
                <rect x="5" y="4" width="10" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                <rect x="7" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              </svg>
              Bestellübersicht
            </button>
          </div>
        </div>

        {/* Kalenderwoche-Auswahl nur für Menü/Orders */}
        {activeTab !== "users" && (
          <div className="flex flex-wrap gap-3 items-center mb-6 bg-blue-50 dark:bg-gray-800 p-2 rounded-xl border border-blue-100 dark:border-gray-700 shadow-inner">
            <label className="flex items-center gap-1 text-gray-700 dark:text-gray-200 text-xs">
              Jahr:
              <input
                type="number"
                value={isoYear}
                onChange={e => setIsoYear(Number(e.target.value))}
                className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-20 focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
              />
            </label>
            <label className="flex items-center gap-1 text-gray-700 dark:text-gray-200 text-xs">
              KW:
              <input
                type="number"
                min={1}
                max={53}
                value={isoWeek}
                onChange={e => setIsoWeek(Number(e.target.value))}
                className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-14 focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
              />
            </label>
          </div>
        )}

        {/* TAB INHALTE */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3">
          {activeTab === "users" && <UsersTable />}
          {activeTab === "menu" && <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />}
          {activeTab === "orders" && <OrdersTable isoYear={isoYear} isoWeek={isoWeek} />}
        </div>
      </div>
      <div className="mt-10 text-xs text-gray-400 dark:text-gray-600 mb-4">© {new Date().getFullYear()} CHECKito Lunch</div>
    </div>
  );
}
