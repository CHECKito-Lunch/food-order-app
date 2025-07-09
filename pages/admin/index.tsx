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

  if (loading) return <div>Lädt...</div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      {/* NAVIGATION */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-t ${activeTab === "users" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          Userverwaltung
        </button>
        <button
          onClick={() => setActiveTab("menu")}
          className={`px-4 py-2 rounded-t ${activeTab === "menu" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          Wochen-Menü Editor
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-t ${activeTab === "orders" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          Bestellübersicht
        </button>
      </div>

      {/* KALENDERWOCHE-AUSWAHL nur für Menü/Orders */}
      {activeTab !== "users" && (
        <div className="flex gap-4 items-center mb-4">
          <label>
            Jahr:{" "}
            <input
              type="number"
              value={isoYear}
              onChange={e => setIsoYear(Number(e.target.value))}
              className="border p-1 w-20"
            />
          </label>
          <label>
            KW:{" "}
            <input
              type="number"
              min={1}
              max={53}
              value={isoWeek}
              onChange={e => setIsoWeek(Number(e.target.value))}
              className="border p-1 w-14"
            />
          </label>
        </div>
      )}

      {/* TAB INHALTE */}
      {activeTab === "users" && <UsersTable />}
      {activeTab === "menu" && <WeekMenuEditor isoYear={isoYear} isoWeek={isoWeek} />}
      {activeTab === "orders" && <OrdersTable isoYear={isoYear} isoWeek={isoWeek} />}
    </div>
  );
}
