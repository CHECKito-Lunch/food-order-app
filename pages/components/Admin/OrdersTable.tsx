import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface OrderAdminRaw {
  id: number;
  location: string;
  profiles: { first_name: string; last_name: string }[];
  week_menus: {
    menu_number: number;
    description: string;
    order_deadline: string;
    caterer: { name: string }[];
    iso_week: number;
    iso_year: number;
  }[];
}

interface OrderAdmin {
  id: number;
  location: string;
  profile: { first_name: string; last_name: string };
  week_menu: {
    menu_number: number;
    description: string;
    order_deadline: string;
    caterer: { name: string };
    iso_week: number;
    iso_year: number;
  };
}

export default function OrdersTable({ isoYear, isoWeek }: { isoYear: number, isoWeek: number }) {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          location,
          profiles(first_name, last_name),
          week_menus(
            menu_number,
            description,
            order_deadline,
            caterer(name),
            iso_week,
            iso_year
          )
        `)
        .eq('week_menus.iso_week', isoWeek)
        .eq('week_menus.iso_year', isoYear);

      if (error) {
        console.error(error);
        setOrders([]);
        setLoading(false);
        return;
      }

      // Typisierung, auch falls Felder mal fehlen
      const raw = (data ?? []) as OrderAdminRaw[];
      const formatted: OrderAdmin[] = raw.map(r => ({
        id: r.id,
        location: r.location ?? "",
        profile: r.profiles[0] ?? { first_name: '', last_name: '' },
        week_menu: {
          menu_number: r.week_menus[0]?.menu_number ?? 0,
          description: r.week_menus[0]?.description ?? '',
          order_deadline: r.week_menus[0]?.order_deadline ?? '',
          caterer: { name: r.week_menus[0]?.caterer[0]?.name ?? '' },
          iso_week: r.week_menus[0]?.iso_week ?? 0,
          iso_year: r.week_menus[0]?.iso_year ?? 0,
        },
      }));

      setOrders(formatted);
      setLoading(false);
    }

    fetchOrders();
  }, [isoYear, isoWeek]);

  // CSV-Export (inkl. Location)
  function exportCSV() {
    const header = ["Vorname", "Nachname", "Location", "KW", "Jahr", "Nr.", "Gericht", "Caterer", "Deadline"];
    const rows = orders.map(o => [
      o.profile.first_name,
      o.profile.last_name,
      o.location,
      o.week_menu.iso_week,
      o.week_menu.iso_year,
      o.week_menu.menu_number,
      o.week_menu.description,
      o.week_menu.caterer.name,
      new Date(o.week_menu.order_deadline).toLocaleString("de"),
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bestellungen_KW${isoWeek}_${isoYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold mb-2">Bestellungen Übersicht (KW {isoWeek}/{isoYear})</h2>
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-1 rounded"
        >
          Exportieren (CSV)
        </button>
      </div>
      {loading ? (
        <div>Lädt...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Vorname</th>
              <th className="p-2 border">Nachname</th>
              <th className="p-2 border">Location</th>
              <th className="p-2 border">KW</th>
              <th className="p-2 border">Jahr</th>
              <th className="p-2 border">Nr.</th>
              <th className="p-2 border">Gericht</th>
              <th className="p-2 border">Caterer</th>
              <th className="p-2 border">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td className="border p-2">{o.profile.first_name}</td>
                <td className="border p-2">{o.profile.last_name}</td>
                <td className="border p-2">{o.location}</td>
                <td className="border p-2">{o.week_menu.iso_week}</td>
                <td className="border p-2">{o.week_menu.iso_year}</td>
                <td className="border p-2">{o.week_menu.menu_number}</td>
                <td className="border p-2">{o.week_menu.description}</td>
                <td className="border p-2">{o.week_menu.caterer.name}</td>
                <td className="border p-2">{new Date(o.week_menu.order_deadline).toLocaleString('de')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
