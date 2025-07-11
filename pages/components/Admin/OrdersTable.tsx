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
        <h2 className="text-xl font-bold text-[#0056b3] dark:text-blue-200">
          Bestellungen Übersicht <span className="font-normal text-gray-500 dark:text-gray-400">(KW {isoWeek}/{isoYear})</span>
        </h2>
        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full shadow font-semibold transition w-full md:w-auto"
        >
          Exportieren (CSV)
        </button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-lg dark:text-gray-100 dark:bg-gray-900">Lädt...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 dark:border-gray-700 shadow bg-white dark:bg-gray-800">
          <table className="min-w-full divide-y divide-blue-100 dark:divide-gray-700">
            <thead>
              <tr className="bg-blue-50 dark:bg-gray-900">
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Vorname</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Nachname</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Location</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">KW</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Jahr</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Nr.</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Gericht</th>
                <th className="p-3 font-semibold text-[#0056b3] dark:text-blue-200">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.first_name}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.last_name}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.location}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.iso_week}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.iso_year}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.menu_number}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{o.menu_description}</td>
                  <td className="p-3 border-t border-blue-100 dark:border-gray-700">{new Date(o.order_deadline).toLocaleString('de')}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-5 text-gray-400 dark:text-gray-500 text-center">
                    Keine Bestellungen gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
