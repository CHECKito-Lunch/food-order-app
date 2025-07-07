import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from 'dayjs';

type WeekMenu = {
  id: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  caterer: { name: string };
  order_deadline: string;
};

type Order = { week_menu_id: number };

export default function Dashboard() {
  const [menus, setMenus] = useState<WeekMenu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const today = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  useEffect(() => {
    // Menüs laden
    supabase
      .from('week_menus')
      .select('*, caterers(name)')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek)
      .order('day_of_week')
      .then(r => r.data && setMenus(r.data as any));

    // Eigene Bestellungen
    supabase
      .from('orders')
      .select('week_menu_id')
      .then(r => r.data && setOrders(r.data as any));
  }, [isoYear, isoWeek]);

  const toggleOrder = async (menuId: number, deadline: string) => {
    if (dayjs(deadline).isBefore(dayjs())) return alert('Frist vorbei');
    const exists = orders.find(o => o.week_menu_id === menuId);
    if (exists) {
      await supabase.from('orders').delete().eq('week_menu_id', menuId);
    } else {
      await supabase.from('orders').insert({ week_menu_id: menuId });
    }
    // State aktualisieren
    const { data } = await supabase.from('orders').select('week_menu_id');
    setOrders(data as any);
  };

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl mb-6">Menü KW {isoWeek} / {isoYear}</h1>
      <div className="grid grid-cols-1 gap-4">
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
                orders.find(o => o.week_menu_id === m.id)
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
            >
              {orders.find(o => o.week_menu_id === m.id) ? 'Stornieren' : 'Bestellen'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
