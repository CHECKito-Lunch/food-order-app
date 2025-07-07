import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type OrderAdmin = {
  id: number;
  week_menus: {
    menu_number: number;
    description: string;
    caterer: { name: string };
    iso_week: number;
    order_deadline: string;
  };
  profiles: { first_name: string; last_name: string };
};

export default function OrdersTable() {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);

  useEffect(() => {
    supabase
      .from('orders')
      .select(`
        id,
        profiles(first_name,last_name),
        week_menus (
          menu_number, description, order_deadline,
          caterer(name), iso_week
        )
      `)
      .then(r => r.data && setOrders(r.data as any));
  }, []);

  return (
    <div className="space-y-2">
      <h2 className="text-xl">Bestellungen Übersicht</h2>
      {orders.map(o => (
        <div key={o.id} className="p-2 border flex justify-between">
          <div>
            <p>{o.profiles.first_name} {o.profiles.last_name} – KW {o.week_menus.iso_week}</p>
            <p>#{o.week_menus.menu_number} {o.week_menus.description}</p>
            <p>Caterer: {o.week_menus.caterer.name}</p>
            <p>Deadline: {new Date(o.week_menus.order_deadline).toLocaleString('de')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
