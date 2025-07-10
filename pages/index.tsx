import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login'; // Pfad ggf. anpassen

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface WeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
  // caterer: { name: string } | null;  // Entfernt!
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

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  // Daten laden (bei user/kw/jahr)
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Menüs (ohne Caterer)
      const { data: menuData } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, description, order_deadline')
        .eq('iso_year', selectedYear)
        .eq('iso_week', selectedWeek)
        .order('day_of_week');

      setMenus((menuData ?? []) as WeekMenu[]);

      // Bestellungen des Users
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, week_menu_id')
        .eq('user_id', user.id);

      setOrders((orderData ?? []) as Order[]);

      // Profil laden
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);
      setProfileEdit(profileData);
    })();
  }, [user, selectedYear, selectedWeek]);

  // Menü-Auswahl: pro Tag ein Menü auswählbar
  const getOrderForDay = (day: number) => {
    const menuIds = menus.filter(m => m.day_of_week === day).map(m => m.id);
    return orders.find(o => menuIds.includes(o.week_menu_id));
  };

  const handleOrder = async (menu: WeekMenu) => {
    const isDeadline = dayjs(menu.order_deadline).isBefore(dayjs());
    if (isDeadline) return alert("Bestellfrist vorbei!");

    // Für diesen Tag alle anderen Bestellungen entfernen
    const menuIdsToday = menus.filter(m => m.day_of_week === menu.day_of_week).map(m => m.id);
    const existingOrder = orders.find(o => menuIdsToday.includes(o.week_menu_id));

    // Lösche ggf. vorherige Bestellung
    if (existingOrder && existingOrder.week_menu_id !== menu.id) {
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    }

    // Falls schon bestellt → Stornieren
    if (existingOrder && existingOrder.week_menu_id === menu.id) {
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    } else {
      await supabase.from('orders').insert({ user_id: user.id, week_menu_id: menu.id });
    }

    // Refresh
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, week_menu_id')
      .eq('user_id', user.id);
    setOrders((orderData ?? []) as Order[]);
  };

  // Profil bearbeiten
  async function saveProfile() {
    if (!profile) return;
    await supabase.from('profiles').update({
      first_name: profileEdit.first_name,
      last_name: profileEdit.last_name,
      location: profileEdit.location,
      email: profileEdit.email,
      // role darf nicht geändert werden!
    }).eq('id', profile.id);
    setEditingProfile(false);
    setProfile({ ...profile, ...profileEdit });
    alert("Profil gespeichert!");
  }

  // --- LOGIN/LOADING LOGIK ---
  if (loading) return <div>Lädt...</div>;
  if (!user) return <Login />;

  // Kalenderwochen-Auswahl erzeugen (aktuell ±10 Jahre, KW 1-53)
  const yearOptions = Array.from({ length: 10 }, (_, i) => today.year() - 5 + i);
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl">Menü-Bestellung</h1>
          <div className="flex gap-4 mt-2 items-center">
            <label>
              Jahr:
              <select
                className="ml-1 border rounded px-2 py-1"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label>
              Kalenderwoche:
              <select
                className="ml-1 border rounded px-2 py-1"
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
          className="bg-gray-200 text-sm px-3 py-1 rounded"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        >Logout</button>
      </div>

      {/* Profil anzeigen/bearbeiten */}
      <div className="mb-6 border p-4 rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Mein Profil</h2>
        {!editingProfile ? (
          <div>
            <p><b>Vorname:</b> {profile?.first_name}</p>
            <p><b>Nachname:</b> {profile?.last_name}</p>
            <p><b>Email:</b> {profile?.email}</p>
            <p><b>Standort:</b> {profile?.location}</p>
            <button
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
              onClick={() => setEditingProfile(true)}
            >Bearbeiten</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              className="border p-1 rounded"
              value={profileEdit.first_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, first_name: e.target.value }))}
              placeholder="Vorname"
            />
            <input
              className="border p-1 rounded"
              value={profileEdit.last_name || ''}
              onChange={e => setProfileEdit(p => ({ ...p, last_name: e.target.value }))}
              placeholder="Nachname"
            />
            <input
              className="border p-1 rounded"
              value={profileEdit.email || ''}
              onChange={e => setProfileEdit(p => ({ ...p, email: e.target.value }))}
              placeholder="Email"
            />
            <input
              className="border p-1 rounded"
              value={profileEdit.location || ''}
              onChange={e => setProfileEdit(p => ({ ...p, location: e.target.value }))}
              placeholder="Standort"
            />
            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={saveProfile}>Speichern</button>
              <button className="px-3 py-1 text-red-600" onClick={() => setEditingProfile(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* Menü + Bestellungen */}
      <div className="space-y-4">
        {WEEKDAYS.map((dayName, idx) => {
          const day = idx + 1;
          const menusOfDay = menus.filter(m => m.day_of_week === day);
          const selectedOrder = getOrderForDay(day);

          return (
            <div key={day} className="border rounded p-4 bg-white">
              <div className="font-semibold mb-2">{dayName}</div>
              {menusOfDay.length === 0 && (
                <div className="text-gray-400">Kein Menü eingetragen.</div>
              )}
              <div className="flex flex-col gap-2">
                {menusOfDay.map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`order-day-${day}`}
                      checked={selectedOrder?.week_menu_id === m.id}
                      disabled={dayjs(m.order_deadline).isBefore(dayjs())}
                      onChange={() => handleOrder(m)}
                    />
                    <span>
                      <b>Nr:</b> {m.menu_number} – {m.description}<br />
                      <span className="text-xs text-gray-500">
                        Deadline: {dayjs(m.order_deadline).format('DD.MM.YYYY HH:mm')}
                        {dayjs(m.order_deadline).isBefore(dayjs()) && " (abgelaufen)"}
                      </span>
                    </span>
                  </label>
                ))}
                {selectedOrder && (
                  <button
                    className="mt-2 px-3 py-1 bg-red-600 text-white rounded"
                    onClick={async () => {
                      await supabase.from('orders').delete().eq('id', selectedOrder.id);
                      // Refresh Orders
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
