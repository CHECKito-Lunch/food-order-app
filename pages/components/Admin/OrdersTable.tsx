import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// Mapping für Wochentags-Nummer zu String
const WEEKDAYS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag'
};

// Mapping für Caterer-ID zu Name
const CATERER_OPTIONS: Record<number, string> = {
  1: 'Dean&David',
  2: 'Merkel',
  3: 'Bloi'
};

interface OrderAdmin {
  id: number;
  first_name: string;
  last_name: string;
  iso_week: number | string;
  day_of_week: number | string;
  menu_number: number | string;
  menu_description: string;
  caterer_id: number | null;
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
          week_menu_id,
          week_menus(
            menu_number,
            menu_description,
            caterer_id,
            day_of_week,
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

      // Formatieren und absichern
      const formatted: OrderAdmin[] = (data ?? []).map((row: any) => {
        const wm = row.week_menus ?? {};
        return {
          id: row.id,
          first_name: row.first_name ?? "",
          last_name: row.last_name ?? "",
          iso_week: wm.iso_week ?? "",
          day_of_week: wm.day_of_week ?? "",
          menu_number: wm.menu_number ?? "",
          menu_description: wm.menu_description ?? "",
          caterer_id: wm.caterer_id ?? null
        };
      });

      setOrders(formatted);
      setLoading(false);
    }

    fetchOrders();
  }, [isoYear, isoWeek]);

  function exportCSV() {
    const header = ["Vorname", "Nachname", "KW", "Tag", "Nr.", "Gericht", "Caterer"];
    const rows = orders.map(o => [
      o.first_name,
      o.last_name,
      o.iso_week,
      typeof o.day_of_week === "number" ? WEEKDAYS[o.day_of_week] : WEEKDAYS[Number(o.day_of_week)] ?? "",
      o.menu_number,
      o.menu_description,
      o.caterer_id ? CATERER_OPTIONS[o.caterer_id] ?? o.caterer_id : ""
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
        <h2 className="text-lg font-bold text-[#0056b3] dark:text-blue-200">
          Bestellungen Übersicht <span className="font-normal text-gray-500 dark:text-gray-400">(KW {isoWeek}/{isoYear})</span>
        </h2>
        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition w-full md:w-auto text-xs"
        >
          Exportieren (CSV)
        </button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-base dark:text-gray-100 dark:bg-gray-900">Lädt...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 dark:border-gray-700 shadow bg-white dark:bg-gray-800">
          <table className="min-w-full divide-y divide-blue-100 dark:divide-gray-700 text-xs">
            <thead>
              <tr className="bg-blue-50 dark:bg-gray-900">
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Vorname</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Nachname</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">KW</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Tag</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Nr.</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Gericht</th>
                <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">Caterer</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.first_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.last_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.iso_week}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {typeof o.day_of_week === "number"
                      ? WEEKDAYS[o.day_of_week]
                      : WEEKDAYS[Number(o.day_of_week)] ?? ""}
                  </td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.menu_number}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.menu_description}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {o.caterer_id ? CATERER_OPTIONS[o.caterer_id] ?? o.caterer_id : ""}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-5 text-gray-400 dark:text-gray-500 text-center">
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
