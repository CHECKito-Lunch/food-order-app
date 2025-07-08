/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-html-link-for-pages */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import dayjs from '../lib/dayjs';

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

  const today   = dayjs();
  const isoYear = today.year();
  const isoWeek = today.week();

  useEffect(() => {
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
  }, [isoYear, isoWeek]);

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

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl mb-6">Menü KW {isoWeek} / {isoYear}</h1>
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
