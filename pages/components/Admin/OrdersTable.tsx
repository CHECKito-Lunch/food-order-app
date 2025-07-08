/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-html-link-for-pages */

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface OrderAdminRaw {
  id: number;
  profiles: { first_name: string; last_name: string }[];
  week_menus: {
    menu_number: number;
    description: string;
    order_deadline: string;
    caterer: { name: string }[];
    iso_week: number;
  }[];
}

interface OrderAdmin {
  id: number;
  profile: { first_name: string; last_name: string };
  week_menu: {
    menu_number: number;
    description: string;
    order_deadline: string;
    caterer: { name: string };
    iso_week: number;
  };
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          profiles(first_name, last_name),
          week_menus(
            menu_number,
            description,
            order_deadline,
            caterer(name),
            iso_week
          )
        `);

      if (error) {
        console.error(error);
        return;
      }

      const raw = (data ?? []) as OrderAdminRaw[];
      const formatted: OrderAdmin[] = raw.map(r => ({
        id: r.id,
        profile: r.profiles[0] ?? { first_name: '', last_name: '' },
        week_menu: {
          menu_number: r.week_menus[0]?.menu_number ?? 0,
          description: r.week_menus[0]?.description ?? '',
          order_deadline: r.week_menus[0]?.order_deadline ?? '',
          caterer: { name: r.week_menus[0]?.caterer[0]?.name ?? '' },
          iso_week: r.week_menus[0]?.iso_week ?? 0,
        },
      }));

      setOrders(formatted);
    }

    fetchOrders();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl">Bestellungen Übersicht</h2>
      {orders.map(o => (
        <div key={o.id} className="p-4 border rounded">
          <p>
            {o.profile.first_name} {o.profile.last_name} – KW {o.week_menu.iso_week}
          </p>
          <p>
            #{o.week_menu.menu_number} {o.week_menu.description}
          </p>
          <p>Caterer: {o.week_menu.caterer.name}</p>
          <p>
            Deadline: {new Date(o.week_menu.order_deadline).toLocaleString('de')}
          </p>
        </div>
      ))}
    </div>
  );
}
