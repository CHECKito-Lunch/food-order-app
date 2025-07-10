import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface OrderAdmin {
  id: number;
  first_name: string;
  last_name: string;
  location: string;
  menu_description: string;
  week_menu_id: number;
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
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <h2 className="text-xl font-bold text-[#0056b3]">Bestellungen Übersicht <span className="font-normal text-gray-500">(KW {isoWeek}/{isoYear})</span></h2>
        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full shadow font-semibold transition w-full md:w-auto"
        >
          Exportieren (CSV)
        </button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-lg">Lädt...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 shadow bg-white">
          <table className="min-w-full divide-y divide-blue-100">
            <thead>
              <tr className="bg-blue-50">
                <th className="p-3 font-semibold text-[#0056b3]">Vorname</th>
                <th className="p-3 font-semibold text-[#0056b3]">Nachname</th>
                <th className="p-3 font-semibold text-[#0056b3]">Location</th>
                <th className="p-3 font-semibold text-[#0056b3]">KW</th>
                <th className="p-3 font-semibold text-[#0056b3]">Jahr</th>
                <th className="p-3 font-semibold text-[#0056b3]">Nr.</th>
                <th className="p-3 font-semibold text-[#0056b3]">Gericht</th>
                <th className="p-3 font-semibold text-[#0056b3]">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50">
                  <td className="p-3 border-t">{o.first_name}</td>
                  <td className="p-3 border-t">{o.last_name}</td>
                  <td className="p-3 border-t">{o.location}</td>
                  <td className="p-3 border-t">{o.iso_week}</td>
                  <td className="p-3 border-t">{o.iso_year}</td>
                  <td className="p-3 border-t">{o.menu_number}</td>
                  <td className="p-3 border-t">{o.menu_description}</td>
                  <td className="p-3 border-t">{new Date(o.order_deadline).toLocaleString('de')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
