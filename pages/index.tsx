import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';
import Login from './login'; // Ggf. Pfad anpassen

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
  week_menu_id: number;
}

export default function Dashboard() {
  const [menus, setMenus] = useState<WeekMenu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const today   = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  // --- AUTH CHECK ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  // Daten nur laden, wenn user vorhanden!
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      const { data, error: menuErr } = await supabase
        .from('week_menus')
        .select('id, day_of_week, menu_number, description, order_deadline, caterers(name)')
        .eq('iso_year', isoYear)
        .eq('iso_week', isoWeek)
        .order('day_of_week');

      if (menuErr) {
        console.error(menuErr);
      } else {
        const raw = (data ?? []) as RawWeekMenu[];
        const formatted: WeekMenu[] = raw.map(({ caterers, ...rest }) => ({
          ...rest,
          caterer: { name: caterers[0]?.name ?? '' },
        }));
        setMenus(formatted);
      }

      const { data: od, error: orderErr } = await supabase
        .from('orders')
        .select('week_menu_id');

      if (orderErr) {
        console.error(orderErr);
      } else {
        setOrders((od ?? []) as Order[]);
      }
    }

    loadData();
  }, [user, isoYear, isoWeek]);

  const toggleOrder = async (menuId: number, deadline: string) => {
    if (dayjs(deadline).isBefore(dayjs())) {
      alert('Bestellfrist vorbei');
      return;
    }
    const exists = orders.some(o => o.week_menu_id === menuId);
    if (exists) {
      await supabase.from('orders').delete().eq('week_menu_id', menuId);
    } else {
      await supabase.from('orders').insert({ week_menu_id: menuId });
    }
    const { data: fresh, error } = await supabase
      .from('orders')
      .select('week_menu_id');
    if (!error) setOrders((fresh ?? []) as Order[]);
  };

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
      <div className="grid gap-4">
        {menus.map(m => (
          <div key={m.id} className="p-4 border rounded flex justify-between items-center">
            <div>
              <p><strong>Tag:</strong> {m.day_of_week}</p>
              <p><strong>Nr.:</strong> {m.menu_number}</p>
              <p><strong>Bezeichnung:</strong> {m.description}</p>
              <p><strong>Caterer:</strong> {m.caterer.name}</p>
              <p><strong>Deadline:</strong> {dayjs(m.order_deadline).format('DD.MM.YYYY HH:mm')}</p>
            </div>
            <button
              onClick={() => toggleOrder(m.id, m.order_deadline)}
              className={`px-4 py-2 rounded ${
                orders.some(o => o.week_menu_id === m.id)
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
            >
              {orders.some(o => o.week_menu_id === m.id) ? 'Stornieren' : 'Bestellen'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
