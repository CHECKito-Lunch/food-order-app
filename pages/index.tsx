import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login'; // Pfad ggf. anpassen

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface RawWeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
  caterers: { name: string }[];
}

interface WeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
  caterer: { name: string };
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
  const [menus, setMenus] = useState<WeekMenu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileEdit, setProfileEdit] = useState<Partial<Profile>>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  // Daten laden
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Menüs
      const { data: menuData } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, description, order_deadline, caterers(name)')
        .eq('iso_year', isoYear)
        .eq('iso_week', isoWeek)
        .order('day_of_week');

      const rawMenus = (menuData ?? []) as RawWeekMenu[];
      const formattedMenus: WeekMenu[] = rawMenus.map(({ caterers, ...rest }) => ({
        ...rest,
        caterer: { name: caterers[0]?.name ?? '' },
      }));
      setMenus(formattedMenus);

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
  }, [user, isoYear, isoWeek]);

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

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl">Menü KW {isoWeek} / {isoYear}</h1>
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
                      <b>Nr:</b> {m.menu_number} – {m.description} ({m.caterer.name})<br />
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
