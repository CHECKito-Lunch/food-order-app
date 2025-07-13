import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login';
import { useRouter } from 'next/router';
// ICONS
import { LogOut, Shield, User, ChevronDown, ChevronUp, Edit, KeyRound } from 'lucide-react';

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface WeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
}
interface Order { id: number; week_menu_id: number; }
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

  // UI states
  const [profileOpen, setProfileOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

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

  const needsProfile = profile && (
    !profile.first_name ||
    !profile.last_name ||
    !profile.location
  );

  // Passwort ändern
  async function handlePasswordChange() {
    if (!password1 || !password2) return alert("Bitte beide Felder ausfüllen.");
    if (password1 !== password2) return alert("Passwörter stimmen nicht überein.");
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: password1 });
    setPwLoading(false);
    if (error) {
      alert("Fehler: " + error.message);
    } else {
      setShowPassword(false);
      setPassword1('');
      setPassword2('');
      alert("Passwort erfolgreich geändert!");
    }
  }

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
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single();
    setProfile(updatedProfile);
    setProfileEdit(updatedProfile);
    setEditingProfile(false);
    alert("Profil gespeichert!");
  }

  const yearOptions = Array.from({ length: 10 }, (_, i) => today.year() - 5 + i);
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 md:px-6 md:py-12 space-y-10 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* Header */}
      <div className="rounded-2xl shadow-md border border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 md:p-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#0056b3] dark:text-blue-200 mb-2 md:mb-1 leading-tight flex items-center gap-2">
            <User className="w-8 h-8" /> CHECKito Lunch
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center text-sm text-gray-700 dark:text-gray-200">
            {/* Jahr */}
            <label className="flex items-center gap-2">
              <span>Jahr:</span>
              <select
                className="border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                className="border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {/* ---- Admin Button ---- */}
          {profile?.role === "admin" && (
            <button
              className="w-full flex items-center gap-2 bg-orange-600 dark:bg-orange-700 hover:bg-orange-700 dark:hover:bg-orange-800 transition text-white text-sm px-6 py-2 rounded-full shadow font-bold"
              onClick={() => window.location.href = "/admin"}
            >
              <Shield className="w-5 h-5" />
              Admin Dashboard
            </button>
          )}
          {/* ---- Logout Button ---- */}
          <button
            className="w-full flex items-center gap-2 bg-[#0056b3] dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 transition text-white text-sm px-6 py-2 rounded-full shadow font-bold"
            onClick={async () => {
              await supabase.auth.signOut();
              setUser(null);
              router.replace('/login');
            }}
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Profilbereich AUSKLAPPBAR */}
      <div className="border border-blue-100 dark:border-gray-700 rounded-2xl shadow bg-white dark:bg-gray-800 p-4 md:p-6">
        <button
          className="flex items-center w-full justify-between text-xl md:text-2xl font-bold text-[#0056b3] dark:text-blue-200 mb-4 focus:outline-none"
          onClick={() => setProfileOpen((v) => !v)}
        >
          <span className="flex items-center gap-2"><User className="w-6 h-6" /> Mein Profil</span>
          {profileOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
        {profileOpen && (
          !editingProfile ? (
            <div className="space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:gap-10 text-sm">
                <div className="mb-1"><span className="font-semibold">Vorname:</span> <span>{profile?.first_name}</span></div>
                <div><span className="font-semibold">Nachname:</span> <span>{profile?.last_name}</span></div>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-10 text-sm">
                <div><span className="font-semibold">Standort:</span> <span>{profile?.location}</span></div>
              </div>
              <button
                className="mt-4 flex items-center justify-center gap-2 px-5 py-1.5 rounded-full bg-[#0056b3] dark:bg-blue-600 text-white text-sm font-bold shadow hover:bg-blue-800 dark:hover:bg-blue-700 transition w-full sm:w-auto"
                onClick={() => setEditingProfile(true)}
              ><Edit className="w-4 h-4" /> Bearbeiten</button>
              {/* Passwort ändern Button */}
              <button
                className="mt-2 flex items-center justify-center gap-2 px-5 py-1.5 rounded-full bg-gray-400 dark:bg-gray-700 text-white text-sm font-bold shadow hover:bg-gray-600 dark:hover:bg-gray-800 transition w-full sm:w-auto"
                onClick={() => setShowPassword(v => !v)}
              >
                <KeyRound className="w-4 h-4" /> Passwort ändern
              </button>
              {showPassword && (
                <div className="mt-4 border-t border-blue-100 dark:border-gray-700 pt-4">
                  <input
                    className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 mb-2 rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    type="password"
                    value={password1}
                    onChange={e => setPassword1(e.target.value)}
                    placeholder="Neues Passwort"
                    autoFocus
                  />
                  <input
                    className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 mb-2 rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    type="password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    placeholder="Passwort bestätigen"
                  />
                  <div className="flex gap-2">
                    <button
                      className="px-5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-700 dark:hover:bg-green-800 w-full"
                      onClick={handlePasswordChange}
                      disabled={pwLoading}
                      type="button"
                    >
                      {pwLoading ? "Speichert..." : "Passwort speichern"}
                    </button>
                    <button
                      className="px-5 py-1.5 text-red-600 rounded-full border border-red-200 dark:border-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900 w-full"
                      onClick={() => { setShowPassword(false); setPassword1(''); setPassword2(''); }}
                      type="button"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-fade-in">
              <input
                className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                value={profileEdit.first_name || ''}
                onChange={e => setProfileEdit(p => ({ ...p, first_name: e.target.value }))}
                placeholder="Vorname"
              />
              <input
                className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                value={profileEdit.last_name || ''}
                onChange={e => setProfileEdit(p => ({ ...p, last_name: e.target.value }))}
                placeholder="Nachname"
              />
              <select
                className="border border-blue-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                value={profileEdit.location || ''}
                onChange={e => setProfileEdit(p => ({ ...p, location: e.target.value }))}
                required
              >
                <option value="">Standort wählen…</option>
                <option value="Nordpol">Nordpol</option>
                <option value="Südpol">Südpol</option>
              </select>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button className="px-5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-700 dark:hover:bg-green-800 w-full sm:w-auto" onClick={saveProfile}>Speichern</button>
                <button className="px-5 py-1.5 text-red-600 rounded-full border border-red-200 dark:border-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900 w-full sm:w-auto" onClick={() => setEditingProfile(false)}>Abbrechen</button>
              </div>
            </div>
          )
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
            <div key={day} className="border border-blue-100 dark:border-gray-700 rounded-2xl shadow bg-white dark:bg-gray-800 p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-[#0056b3] dark:text-blue-200 mb-3 flex flex-wrap items-center gap-3">
                {dayName}
                <span className="text-xs md:text-base text-gray-500 dark:text-gray-400 font-normal">
                  ({tagDatum.format("DD.MM.YYYY")})
                </span>
              </div>
              {menusOfDay.length === 0 && (
                <div className="text-gray-400 dark:text-gray-500 mb-2">Kein Menü eingetragen.</div>
              )}
              <div className="flex flex-col gap-3">
                {menusOfDay.map(m => (
                  <label key={m.id} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 transition leading-relaxed text-sm">
                    <input
                      type="radio"
                      name={`order-day-${day}`}
                      checked={selectedOrder?.week_menu_id === m.id}
                      disabled={dayjs(m.order_deadline).isBefore(dayjs())}
                      onChange={() => handleOrder(m)}
                      className="accent-[#0056b3] dark:accent-blue-400 w-5 h-5"
                    />
                    <span>
                      <span className="font-semibold">Nr:</span> {m.menu_number} – <span className="font-medium">{m.description}</span><br />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Deadline: {dayjs(m.order_deadline).format('DD.MM.YYYY HH:mm')}
                        {dayjs(m.order_deadline).isBefore(dayjs()) && " (abgelaufen)"}
                      </span>
                    </span>
                  </label>
                ))}
                {selectedOrder && (
                  <button
                    className="mt-1 px-5 py-1.5 bg-red-600 dark:bg-red-700 text-white rounded-full text-sm font-semibold hover:bg-red-700 dark:hover:bg-red-800 shadow transition w-full sm:w-auto"
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
