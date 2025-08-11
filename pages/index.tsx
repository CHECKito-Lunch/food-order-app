import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login';
import { useRouter } from 'next/router';
import { LogOut, Shield, User, ChevronDown, ChevronUp, Edit, KeyRound } from 'lucide-react';
import { FiCheckCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';



const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface WeekMenu {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  order_deadline: string;
  is_veggie?: boolean;
  is_vegan?: boolean;
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

// === Snackbar-Komponente ===
function Snackbar({ show, summary }: { show: boolean; summary: string }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl z-50 animate-fadeIn">
      <FiCheckCircle size={28} className="text-white drop-shadow" />
      <div>
        <div className="font-semibold">Bestellung eingegangen!</div>
        <div className="text-xs opacity-90">{summary}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = dayjs();
  const nextWeek = today.add(1, 'week');
  const router = useRouter();

  // Standardmäßig immer nächste Woche vorauswählen!
  const [selectedYear, setSelectedYear] = useState(nextWeek.year());
  const [selectedWeek, setSelectedWeek] = useState(nextWeek.week());

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

  // --- NEU: Bestellstatus (Loader/Snackbar) ---
  const [savingOrder, setSavingOrder] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarSummary, setSnackbarSummary] = useState('');

  // --- Profil-Save Loader / Feedback ---
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedSnackbar, setProfileSavedSnackbar] = useState(false);

  // --- NEU: Deadline-Banner State & Effect ---
  const [deadlineReminders, setDeadlineReminders] = useState<WeekMenu[]>([]);
  const [showBanner, setShowBanner] = useState(true);

  // Session holen
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  // Menüs, Orders & Profile holen
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: menuData } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, description, order_deadline, is_veggie, is_vegan, iso_year, iso_week')
        .eq('iso_year', selectedYear)
        .eq('iso_week', selectedWeek)
        .order('day_of_week');
      setMenus(menuData ?? []);

      const { data: orderData } = await supabase
        .from('orders')
        .select('id, week_menu_id')
        .eq('user_id', user.id);
      setOrders(orderData ?? []);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);
      setProfileEdit(profileData);
    })();
  }, [user, selectedYear, selectedWeek]);

  // Deadline-Erinnerungen (nächste 24h)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, order_deadline')
        .eq('iso_year', selectedYear)
        .eq('iso_week', selectedWeek)
        .gte('order_deadline', now.toISOString())
        .lte('order_deadline', in24h.toISOString());
      if (error) {
        console.error('Fehler beim Laden der Deadlines:', error);
      } else {
        setDeadlineReminders(data ?? []);
        setShowBanner(true);
      }
    })();
  }, [user, selectedYear, selectedWeek]);


  
  // Banner automatisch schließen, wenn keine Reminders
  useEffect(() => {
    if (deadlineReminders.length === 0) {
      setShowBanner(false);
    }
  }, [deadlineReminders]);

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

  // Loader / Redirects
  if (loading) return <div className="h-screen flex items-center justify-center text-lg dark:bg-gray-900 dark:text-gray-100">Lädt...</div>;
  if (!user) return <Login />;

  // Profil vervollständigen
  if (needsProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 dark:bg-gray-900">
        {(savingProfile || profileSavedSnackbar) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30">
            {savingProfile ? (
              <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-xl border border-blue-200">
                <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-base font-semibold text-[#0056b3]">Profil wird gespeichert…</span>
              </div>
            ) : (
              <div className="bg-green-600 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl">
                <FiCheckCircle size={28} className="text-white" />
                <div className="font-semibold">Profil gespeichert!</div>
              </div>
            )}
          </div>
        )}
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
              <button
                className="px-5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-700 dark:hover:bg-green-800 w-full"
                onClick={async () => {
                  setSavingProfile(true);
                  await supabase.from('profiles').update({
                    first_name: profileEdit.first_name,
                    last_name: profileEdit.last_name,
                    location: profileEdit.location,
                  }).eq('id', profile!.id);
                  const { data: updatedProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', profile!.id)
                    .single();
                  setProfile(updatedProfile);
                  setProfileEdit(updatedProfile);
                  setEditingProfile(false);
                  setSavingProfile(false);
                  setProfileSavedSnackbar(true);
                  setTimeout(() => setProfileSavedSnackbar(false), 2200);
                }}
              >Speichern</button>
              <button
                className="px-5 py-1.5 text-red-600 rounded-full border border-red-200 dark:border-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900 w-full"
                onClick={() => setEditingProfile(false)}
              >Abbrechen</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Hilfsfunktion, um vorhandene Bestellung zu finden
  const getOrderForDay = (day: number) => {
    const menuIds = menus.filter(m => m.day_of_week === day).map(m => m.id);
    return orders.find(o => menuIds.includes(o.week_menu_id));
  };

  // Bestellung anlegen / löschen mit Snackbar
  const handleOrder = async (menu: WeekMenu) => {
    if (!profile) return;
    const isDeadline = dayjs(menu.order_deadline).isBefore(dayjs());
    if (isDeadline) return alert("Bestellfrist vorbei!");

    setSavingOrder(true);
    setShowSnackbar(false);

    const menuIdsToday = menus.filter(m => m.day_of_week === menu.day_of_week).map(m => m.id);
    const existingOrder = orders.find(o => menuIdsToday.includes(o.week_menu_id));
    if (existingOrder) {
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    }
    if (!existingOrder || existingOrder.week_menu_id !== menu.id) {
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
    setOrders(orderData ?? []);

    const wochentag = WEEKDAYS[menu.day_of_week - 1] || '';
    setSnackbarSummary(`Du hast am ${wochentag} das Menü "${menu.description}" für KW ${selectedWeek} bestellt.`);
    setShowSnackbar(true);
    setSavingOrder(false);
    setTimeout(() => setShowSnackbar(false), 2500);
  };

  const yearOptions = Array.from({ length: 10 }, (_, i) => today.year() - 5 + i);
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-12 space-y-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen">

           {/* Roter, weicher Banner mit Close- und Scroll-Button */}
{showBanner && deadlineReminders.length > 0 && (() => {
  const next = deadlineReminders[0];
  const diffHours   = dayjs(next.order_deadline).diff(dayjs(), 'hour');
  const diffMinutes = dayjs(next.order_deadline)
                         .diff(dayjs().add(diffHours, 'hour'), 'minute');
  const tagName  = WEEKDAYS[next.day_of_week - 1];
  const tagDatum = dayjs()
    .year(selectedYear)
    .week(selectedWeek)
    .day(next.day_of_week);
  const menuDate = tagDatum.format('DD.MM.YYYY');
  const targetId = `day-${next.day_of_week}`;


      return (
        <div
          className="
            sticky top-[env(safe-area-inset-top)]
            mx-4
            bg-red-100 text-red-800
            rounded-lg shadow-md
            px-4 py-3 pr-12
            text-sm leading-snug
            relative z-50
            flex items-center justify-between space-x-3
          "
        >
          {/* Close */}
          <button
            onClick={() => setShowBanner(false)}
            className="absolute top-1 right-3 text-red-800 font-bold leading-none focus:outline-none"
            aria-label="Banner schließen"
          >×</button>

          {/* Text */}
          <span className="flex-1 text-center">
            <strong>Achtung!</strong> für <strong>{tagName}</strong> den {menuDate} läuft die Bestellfrist in {diffHours} Stunden {diffMinutes} Minuten aus!
          </span>

          {/* Scroll */}
          <button
            onClick={() => {
              document
                .getElementById(targetId)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="
              bg-red-200 hover:bg-red-300
              text-red-800 font-medium
              px-2 py-1 rounded
              shadow-sm text-xs
              focus:outline-none
            "
          >Zum Tag</button>
        </div>
      );
    })()}


      {/* Loader während Bestellung */}
      {savingOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-xl border border-blue-200">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-base font-semibold text-[#0056b3]">Bestellung wird gespeichert…</span>
          </div>
        </div>
      )}
      <Snackbar show={showSnackbar} summary={snackbarSummary} />



      {/* Header */}
      <div className="rounded-2xl shadow-md border border-blue-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 md:p-4">
        <div>
          <h1 className="text-xl md:text-xl font-bold text-[#0056b3] dark:text-blue-200 mb-2 md:mb-1 leading-tight flex items-center gap-2">
            <User className="w-8 h-8" /> CHECKito Lunch
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center text-sm text-gray-700 dark:text-gray-200">
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
          {profile?.role === "admin" && (
            <button
              className="w-full flex items-center gap-2 bg-orange-600 dark:bg-orange-700 hover:bg-orange-700 dark:hover:bg-orange-800 transition text-white text-sm px-6 py-2 rounded-full shadow font-bold"
              onClick={() => window.location.href = "/admin"}
            >
              <Shield className="w-5 h-5" />
              Admin Dashboard
            </button>
          )}
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
      <div className="rounded-2xl shadow-md border border-blue-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 md:p-4">
        <button
          className="flex items-center w-full justify-between text-xl md:text-xl leading-tight font-bold text-[#0056b3] dark:text-blue-200 mb-4 focus:outline-none"
          onClick={() => setProfileOpen(v => !v)}
        >
          <span className="flex items-center gap-2"><User className="w-8 h-8" /> Mein Profil</span>
          {profileOpen ? <ChevronUp className="w-8 h-8" /> : <ChevronDown className="w-8 h-8" />}
        </button>
        {profileOpen && !editingProfile && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:gap-10 text-sm">
              <div className="mb"><span className="font-semibold">Vorname:</span> <span>{profile?.first_name}</span></div>
              <div><span className="font-semibold">Nachname:</span> <span>{profile?.last_name}</span></div>
          
              <div><span className="font-semibold">Standort:</span> <span>{profile?.location}</span></div>
            </div>
            <button
              className="mt-4 flex items-center justify-center gap-2 px-5 py-1.5 rounded-full bg-[#0056b3] dark:bg-blue-600 text-white text-sm font-bold shadow hover:bg-blue-800 dark:hover:bg-blue-700 transition w-full sm:w-auto"
              onClick={() => setEditingProfile(true)}
            ><Edit className="w-4 h-4" /> Bearbeiten</button>
            <button
              className="mt-2 flex items-center justify-center gap-2 px-5 py-1.5 rounded-full bg-gray-400 dark:bg-gray-700 text-white text-sm font-bold shadow hover:bg-gray-600 dark:hover:bg-gray-800 transition w-full sm:w-auto"
              onClick={() => setShowPassword(v => !v)}
            ><KeyRound className="w-4 h-4" /> Passwort ändern</button>
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
        )}
        {profileOpen && editingProfile && (
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
              <button
                className="px-5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-700 dark:hover:bg-green-800 w-full sm:w-auto"
                onClick={async () => {
                  setSavingProfile(true);
                  await supabase.from('profiles').update({
                    first_name: profileEdit.first_name,
                    last_name: profileEdit.last_name,
                    location: profileEdit.location,
                  }).eq('id', profile!.id);
                  const { data: updatedProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', profile!.id)
                    .single();
                  setProfile(updatedProfile);
                  setProfileEdit(updatedProfile);
                  setEditingProfile(false);
                  setSavingProfile(false);
                  setProfileSavedSnackbar(true);
                  setTimeout(() => setProfileSavedSnackbar(false), 2200);
                }}
              >Speichern</button>
              <button className="px-5 py-1.5 text-red-600 rounded-full border border-red-200 dark:border-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900 w-full sm:w-auto" onClick={() => setEditingProfile(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* Mini-Übersicht: Bestellungen/Woche */}
<div className="rounded-2xl shadow-md border border-blue-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-4">
        <h1 className="text-xl md:text-xl font-bold text-[#0056b3] dark:text-blue-200 mb-2 md:mb-1 leading-tight flex items-center gap-2">
            Deine Wochenübersicht
          </h1>
<div className="overflow-x-auto mb-6">
  <div className="flex gap-1 py-4 min-w-[350px] md:min-w-0 justify-center">
    {WEEKDAYS.map((dayName, idx) => {
      const day = idx + 1;
      const menusOfDay = menus
        .filter(m => m.day_of_week === day)
        .sort((a, b) => (a.menu_number ?? 0) - (b.menu_number ?? 0));
      const selectedOrder = getOrderForDay(day);
      const tagDatum = dayjs().year(selectedYear).week(selectedWeek).day(day);
      let badgeColor = selectedOrder ? 'bg-green-600 border-green-700 text-white' : 'bg-red-500 border-red-700 text-white';
      let icon = selectedOrder
        ? <span className="text-lg ml-1 align-middle">✔️</span>
        : <span className="text-lg ml-1 align-middle">❌</span>;

      // Menü-Info für Tooltip/Icon, falls bestellt
      let menuIcons = null;
      let menuDesc = '';
      if (selectedOrder) {
        const orderedMenu = menusOfDay.find(m => m.id === selectedOrder.week_menu_id);
        if (orderedMenu) {
          menuIcons = (
            <>
              {orderedMenu.is_veggie && <span title="Vegetarisch" className="ml-1" role="img" aria-label="Vegetarisch">🥦</span>}
              {orderedMenu.is_vegan && <span title="Vegan" className="ml-1" role="img" aria-label="Vegan">🌱</span>}
            </>
          );
          menuDesc = orderedMenu.description;
        }
      }

      return (
        <button
          key={day}
          type="button"
          onClick={() => document.getElementById(`day-${day}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={`
            flex flex-col items-center justify-center
            ${badgeColor} border-2 rounded-2xl shadow font-semibold
            min-w-[70px] max-w-[80px] h-[68px]
            px-2 py-1 transition hover:brightness-110 focus:outline-none
          `}
          title={selectedOrder && menuDesc ? `${dayName} (${tagDatum.format("DD.MM.")}): ${menuDesc}` : dayName}
        >
          <div className="text-xs mb-0.5">{dayName}</div>
          <div className="flex items-center justify-center h-5">
            {icon} {menuIcons}
          </div>
          <div className="text-[11px] mt-0.5">{tagDatum.format("DD.MM.")}</div>
        </button>
      );
    })}
    </div>
  </div>
</div>

      {/* LEGENDE */}
    
      <div className="rounded-2xl shadow-md border border-blue-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-4">
        <h1 className="text-xl md:text-xl font-bold text-[#0056b3] dark:text-blue-200 mb-2 md:mb-1 leading-tight flex items-center gap-2">
            Legende
          </h1>
        <span className="flex items-center gap-1">
          <span role="img" aria-label="Vegetarisch" className="text-lg">🥦</span>
          Vegetarisch
        </span>
        <span className="flex items-center gap-1">
          <span role="img" aria-label="Vegan" className="text-lg">🌱</span>
          Vegan
        </span>
      </div>

{/* Menü + Bestellungen */}
<div className="space-y-6">
  {WEEKDAYS.map((dayName, idx) => {
    const day = idx + 1;
    const menusOfDay = menus
      .filter(m => m.day_of_week === day)
      .sort((a, b) => (a.menu_number ?? 0) - (b.menu_number ?? 0));
    const selectedOrder = getOrderForDay(day);
    const tagDatum = dayjs().year(selectedYear).week(selectedWeek).day(day);

    // Das bestellte Menü (falls vorhanden) für diesen Tag ermitteln:
    const orderedMenu = selectedOrder
      ? menusOfDay.find(m => m.id === selectedOrder.week_menu_id)
      : null;
    const isOrderDeadline = orderedMenu
      ? dayjs(orderedMenu.order_deadline).isBefore(dayjs())
      : false;

    return (
      <div id={`day-${day}`} key={day} className="rounded-2xl shadow-md border border-blue-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-4">
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
          {menusOfDay.map(m => {
            const isDeadline = dayjs(m.order_deadline).isBefore(dayjs());
            const checked = selectedOrder?.week_menu_id === m.id;
            return (
              <label
                key={m.id}
                className={`
                  flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 transition leading-relaxed text-sm
                  ${isDeadline ? 'opacity-70' : 'hover:bg-blue-50 dark:hover:bg-gray-700'}
                `}
              >
                <span
                  className={`
                    relative flex items-center justify-center
                    w-5 h-5 min-w-[1.25rem] min-h-[1.25rem]
                    rounded-full border-2
                    ${checked
                      ? isDeadline
                        ? 'border-red-600'
                        : 'border-[#0056b3]'
                      : isDeadline
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }
                    bg-white transition
                  `}
                >
                  <input
                    type="radio"
                    name={`order-day-${day}`}
                    checked={checked}
                    disabled={isDeadline}
                    onChange={() => handleOrder(m)}
                    className="absolute opacity-0 w-full h-full m-0 cursor-pointer"
                    tabIndex={isDeadline ? -1 : 0}
                  />
                  {checked && (
                    <span
                      className={`
                        pointer-events-none
                        absolute top-1/2 left-1/2
                        w-2.5 h-2.5
                        -translate-x-1/2 -translate-y-1/2
                        rounded-full
                        ${isDeadline ? 'bg-red-600' : 'bg-[#0056b3]'}
                      `}
                    />
                  )}
                </span>
                <span>
                  <span className="font-semibold">Nr:</span> {m.menu_number} – 
                  <span className="font-medium">
                    {m.description}
                    {m.is_veggie && (
                      <span title="Vegetarisch" className="ml-1" role="img" aria-label="Vegetarisch">🥦</span>
                    )}
                    {m.is_vegan && (
                      <span title="Vegan" className="ml-1" role="img" aria-label="Vegan">🌱</span>
                    )}
                  </span>
                  <br />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Deadline: {dayjs.utc(m.order_deadline).tz('Europe/Berlin').format('DD.MM.YYYY HH:mm')}
                    {isDeadline && (
                      <b className="text-red-600 font-bold ml-1">(abgelaufen)</b>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
          {selectedOrder && (
            <button
          
              className={`
                mt-1 px-5 py-1.5 rounded-full text-sm font-semibold shadow transition w-full sm:w-auto
                ${isOrderDeadline
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800'
                }
              `}
              onClick={async () => {
                if (isOrderDeadline) return;
                await supabase.from('orders').delete().eq('id', selectedOrder.id);
                const { data: orderData } = await supabase
                  .from('orders')
                  .select('id, week_menu_id')
                  .eq('user_id', user.id);
                setOrders(orderData ?? []);
              }}
              disabled={isOrderDeadline}
              
            >
              Bestellung stornieren
            </button>
          )}
        </div>
      </div>
    );
  })}
</div>
    </div>
  );
}
