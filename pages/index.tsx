import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login';

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
      email: profileEdit.email,
    }).eq('id', profile.id);
    setEditingProfile(false);
    setProfile({ ...profile, ...profileEdit });
    alert("Profil gespeichert!");
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-lg">Lädt...</div>;
  if (!user) return <Login />;

  const yearOptions = Array.from({ length: 10 }, (_, i) => today.year() - 5 + i);
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 md:px-6 md:py-12 space-y-10">
      {/* Header */}
      <div className="rounded-2xl shadow-md border border-blue-100 bg-white flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6 md:p-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#0056b3] mb-3 md:mb-2 leading-tight">
            Menü-Bestellung
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center text-base text-gray-700">
            {/* Jahr */}
            <label className="flex items-center gap-2">
              <span>Jahr:</span>
              <select
                className="border border-blue-200 rounded px-3 py-2 focus:ring-2 focus:ring-blue-400"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            {/* Kalenderwoche */}
            <label className="flex items-center gap-2">
              <span>Kalenderwoche:</span>
              <select
                className="border border-blue-200 rounded px-3 py-2 focus:ring-2 focus:ring-blue-400"
                value={selectedWeek}
                onChange={e => setSelectedWeek(Number(e.target.value))}
              >
                {weekOptions.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          className="w-full sm:w-auto mt-4 md:mt-0 bg-[#0056b3] hover:bg-blue-800 transition text-white text-lg px-7 py-3 rounded-full shadow font-bold"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        >Logout</button>
      </div>

      {/* Profil anzeigen/bearbeiten */}
      <div className="border border-blue-100 rounded-2xl shadow bg-white p-6 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold text-[#0056b3] mb-4">Mein Profil</h2>
        {!editingProfile ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:gap-10">
              <div className="mb-1"><span className="font-semibold">Vorname:</span> <span>{profile?.first_name}</span></div>
              <div><span className="font-semibold">Nachname:</span> <span>{profile?.last_name}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-10">
              <div className="mb-1"><span className="font-semibold">Email:</span> <span>{profile?.email}</span></div>
              <div><span className="font-semibold">Standort:</span> <span>{profile?.location}</span></div>
            </div>
            <button
              className="mt-4 px-6 py-2 rounded-full bg-[#0056b3] text-white text-base font-bold shadow hover:bg-blue-800 transition w-full sm:w-auto"
              onClick={() => setEditingProfile(true)}
            >Bearbeiten</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              className="border border-blue-200 p-3 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={profileEdit.first_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, first_name: e.target.value }))}
              placeholder="Vorname"
            />
            <input
              className="border border-blue-200 p-3 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={profileEdit.last_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, last_name: e.target.value }))}
              placeholder="Nachname"
            />
            <input
              className="border border-blue-200 p-3 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={profileEdit.email || ''}
              onChange={e => setProfileEdit(p => ({ ...p, email: e.target.value }))}
              placeholder="Email"
            />
            <input
              className="border border-blue-200 p-3 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={profileEdit.location || ''}
              onChange={e => setProfileEdit(p => ({ ...p, location: e.target.value }))}
              placeholder="Standort"
            />
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button className="px-6 py-2 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 w-full sm:w-auto" onClick={saveProfile}>Speichern</button>
              <button className="px-6 py-2 text-red-600 rounded-full border border-red-200 hover:bg-red-50 w-full sm:w-auto" onClick={() => setEditingProfile(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* Menü + Bestellungen */}
      <div className="space-y-6">
        {WEEKDAYS.map((dayName, idx) => {
          const day = idx + 1;
          const menusOfDay = menus.filter(m => m.day_of_week === day);
          const selectedOrder = getOrderForDay(day);
          const tagDatum = dayjs().year(selectedYear).week(selectedWeek).day(day);
          return (
            <div key={day} className="border border-blue-100 rounded-2xl shadow bg-white p-5 md:p-8">
              <div className="font-semibold text-lg md:text-xl mb-3 text-[#0056b3] flex flex-wrap items-center gap-3">
                {dayName}
                <span className="text-xs md:text-base text-gray-500 font-normal">
                  ({tagDatum.format("DD.MM.YYYY")})
                </span>
              </div>
              {menusOfDay.length === 0 && (
                <div className="text-gray-400 mb-2">Kein Menü eingetragen.</div>
              )}
              <div className="flex flex-col gap-4">
                {menusOfDay.map(m => (
                  <label key={m.id} className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-3 hover:bg-blue-50 transition leading-relaxed">
                    <input
                      type="radio"
                      name={`order-day-${day}`}
                      checked={selectedOrder?.week_menu_id === m.id}
                      disabled={dayjs(m.order_deadline).isBefore(dayjs())}
                      onChange={() => handleOrder(m)}
                      className="accent-[#0056b3] w-5 h-5"
                    />
                    <span>
                      <span className="font-semibold">Nr:</span> {m.menu_number} – <span className="font-medium">{m.description}</span><br />
                      <span className="text-xs text-gray-500">
                        Deadline: {dayjs(m.order_deadline).format('DD.MM.YYYY HH:mm')}
                        {dayjs(m.order_deadline).isBefore(dayjs()) && " (abgelaufen)"}
                      </span>
                    </span>
                  </label>
                ))}
                {selectedOrder && (
                  <button
                    className="mt-1 px-6 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 shadow transition w-full sm:w-auto"
                    onClick={async () => {
                      await supabase.from('orders').delete().eq('id', selectedOrder.id);
                      const { data: orderData } = await supabase
                        .from('orders')
                        .select('id, week_menu_id')
                        .eq('user_id', user.id);
                      setOrders((orderData ?? []) as Order[]);
                    }}
                  >Bestellung stornieren</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
