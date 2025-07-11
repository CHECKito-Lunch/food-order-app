import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login';
import { useRouter } from 'next/router';

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface WeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
}

interface Order {
  id: number;
  week_menu_id: number;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  location: string;
  email: string;
  role: string;
}

export default function Dashboard() {
  const today = dayjs();
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(today.year());
  const [selectedWeek, setSelectedWeek] = useState(today.week());
  const [menus, setMenus] = useState<WeekMenu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileEdit, setProfileEdit] = useState<Partial<Profile>>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: menuData } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, description, order_deadline')
        .eq('iso_year', selectedYear)
        .eq('iso_week', selectedWeek)
        .order('day_of_week');
      setMenus((menuData ?? []) as WeekMenu[]);

      const { data: orderData } = await supabase
        .from('orders')
        .select('id, week_menu_id')
        .eq('user_id', user.id);
      setOrders((orderData ?? []) as Order[]);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);
      setProfileEdit(profileData);
    })();
  }, [user, selectedYear, selectedWeek]);

  // ---- PROFIL VERVOLLSTÄNDIGEN: Zeige Hinweis, wenn Vorname, Nachname ODER Standort fehlt ---
  const needsProfile = profile && (
    !profile.first_name ||
    !profile.last_name ||
    !profile.location
  );

  if (loading) return <div className="h-screen flex items-center justify-center text-lg dark:bg-gray-900 dark:text-gray-100">Lädt...</div>;
  if (!user) return <Login />;

  if (needsProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-2xl shadow-md p-6 md:p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-[#0056b3] dark:text-blue-200 mb-4">Profil vervollständigen</h2>
          <p className="mb-6 text-gray-700 dark:text-gray-200">
            Bitte fülle <b>Vorname, Nachname und Standort</b> aus, um fortzufahren.
          </p>
          <button
            onClick={() => setEditingProfile(true)}
            className="bg-[#0056b3] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-2 px-6 rounded-full font-semibold shadow transition text-sm"
          >
            Profil jetzt vervollständigen
          </button>
        </div>
        {editingProfile && (
          <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-2xl shadow-md p-6 md:p-8 max-w-md mt-8 w-full">
            <h2 className="text-xl font-bold text-[#0056b3] dark:text-blue-200 mb-4">Profil bearbeiten</h2>
            <input
              className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-3 w-full"
              value={profileEdit.first_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, first_name: e.target.value }))}
              placeholder="Vorname"
            />
            <input
              className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-3 w-full"
              value={profileEdit.last_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, last_name: e.target.value }))}
              placeholder="Nachname"
            />
            <select
              className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-3 w-full"
              value={profileEdit.location || ''}
              onChange={e => setProfileEdit(p => ({ ...p, location: e.target.value }))}
              required
            >
              <option value="">Standort wählen…</option>
              <option value="Nordpol">Nordpol</option>
              <option value="Südpol">Südpol</option>
            </select>
            <div className="flex gap-3 mt-2">
              <button className="px-5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-700 dark:hover:bg-green-800 w-full" onClick={saveProfile}>Speichern</button>
              <button className="px-5 py-1.5 text-red-600 rounded-full border border-red-200 dark:border-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900 w-full" onClick={() => setEditingProfile(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
    );
  }
  // -----------------------------------------------------------------------------

  const getOrderForDay = (day: number) => {
    const menuIds = menus.filter(m => m.day_of_week === day).map(m => m.id);
    return orders.find(o => menuIds.includes(o.week_menu_id));
  };

  const handleOrder = async (menu: WeekMenu) => {
    if (!profile) return;
    const isDeadline = dayjs(menu.order_deadline).isBefore(dayjs());
    if (isDeadline) return alert("Bestellfrist vorbei!");
    const menuIdsToday = menus.filter(m => m.day_of_week === menu.day_of_week).map(m => m.id);
    const existingOrder = orders.find(o => menuIdsToday.includes(o.week_menu_id));
    if (existingOrder && existingOrder.week_menu_id !== menu.id) {
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    }
    if (existingOrder && existingOrder.week_menu_id === menu.id) {
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    } else {
      await supabase.from('orders').insert({
        user_id: user.id,
        week_menu_id: menu.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        location: profile.location,
        menu_description: menu.description,
      });
    }
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, week_menu_id')
      .eq('user_id', user.id);
    setOrders((orderData ?? []) as Order[]);
  };

  async function saveProfile() {
    if (!profile) return;
    await supabase.from('profiles').update({
      first_name: profileEdit.first_name,
      last_name: profileEdit.last_name,
      location: profileEdit.location,
    }).eq('id', profile.id);
    setEditingProfile(false);
    setProfile({ ...profile, ...profileEdit });
    alert("Profil gespeichert!");
  }

  const yearOptions = Array.from({ length: 10 }, (_, i) => today.year() - 5 + i);
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 md:px-6 md:py-12 space-y-10 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* ...Restlicher Code (Header, Profil, Menüs etc.)... */}
      {/* (wie gehabt, wird nicht verändert) */}
      {/* ... */}
    </div>
  );
}
