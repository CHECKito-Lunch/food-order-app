import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface OrderAdmin {
  id: number;
  first_name: string;
  last_name: string;
  location: string;
  menu_description: string;
  week_menu_id: number;
  // Diese Felder für Anzeige/Export:
  iso_week: number;
  iso_year: number;
  menu_number: number;
  order_deadline: string;
}

export default function OrdersTable({ isoYear, isoWeek }: { isoYear: number, isoWeek: number }) {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      // week_menu Infos (nummer, deadline, iso_week/year) holen wir uns aus Join
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          first_name,
          last_name,
          location,
          menu_description,
          week_menu_id,
          week_menus(menu_number, order_deadline, iso_week, iso_year)
        `)
        .eq('week_menus.iso_week', isoWeek)
        .eq('week_menus.iso_year', isoYear);

      if (error) {
        console.error(error);
        setOrders([]);
        setLoading(false);
        return;
      }

      // Typisierung
      const formatted: OrderAdmin[] = (data ?? []).map((row: any) => ({
        id: row.id,
        first_name: row.first_name ?? "",
        last_name: row.last_name ?? "",
        location: row.location ?? "",
        menu_description: row.menu_description ?? "",
        week_menu_id: row.week_menu_id,
        menu_number: row.week_menus?.menu_number ?? 0,
        order_deadline: row.week_menus?.order_deadline ?? "",
        iso_week: row.week_menus?.iso_week ?? 0,
        iso_year: row.week_menus?.iso_year ?? 0,
      }));

      setOrders(formatted);
      setLoading(false);
    }

    fetchOrders();
  }, [isoYear, isoWeek]);

  // CSV-Export (inkl. Location)
  function exportCSV() {
    const header = ["Vorname", "Nachname", "Location", "KW", "Jahr", "Nr.", "Gericht", "Deadline"];
    const rows = orders.map(o => [
      o.first_name,
      o.last_name,
      o.location,
      o.iso_week,
      o.iso_year,
      o.menu_number,
      o.menu_description,
      new Date(o.order_deadline).toLocaleString("de"),
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
              <th className="p-2 border">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td className="border p-2">{o.first_name}</td>
                <td className="border p-2">{o.last_name}</td>
                <td className="border p-2">{o.location}</td>
                <td className="border p-2">{o.iso_week}</td>
                <td className="border p-2">{o.iso_year}</td>
                <td className="border p-2">{o.menu_number}</td>
                <td className="border p-2">{o.menu_description}</td>
                <td className="border p-2">{new Date(o.order_deadline).toLocaleString('de')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
