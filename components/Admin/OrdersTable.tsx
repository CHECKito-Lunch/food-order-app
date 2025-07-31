import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const WEEKDAYS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag'
};
const CATERER_OPTIONS: Record<number, string> = {
  1: 'Dean&David',
  2: 'Merkel',
  3: 'Bloi'
};

interface OrderAdmin {
  id: number;
  first_name: string;
  last_name: string;
  location: string;
  iso_week: number | string;
  day_of_week: number | string;
  menu_number: number | string;
  description: string;
  caterer_id: number | null;
}

export default function OrdersTable({ isoYear, isoWeek }: { isoYear: number, isoWeek: number }) {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);

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
          week_menu_id,
          week_menus (
            menu_number,
            description,
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

      const formatted: OrderAdmin[] = (data ?? [])
        .filter((row: any) => row.week_menus && row.week_menus.menu_number)
        .map((row: any) => {
          const wm = row.week_menus ?? {};
          return {
            id: row.id,
            first_name: row.first_name ?? "",
            last_name: row.last_name ?? "",
            location: row.location ?? "",
            iso_week: wm.iso_week ?? "",
            day_of_week: wm.day_of_week ?? "",
            menu_number: wm.menu_number ?? "",
            description: wm.description ?? "",
            caterer_id: wm.caterer_id ?? null,
          };
        });

      setOrders(formatted);
      setLoading(false);
    }

    fetchOrders();
  }, [isoYear, isoWeek]);

  function exportCSV() {
    const header = ["Vorname", "Nachname", "Standort", "KW", "Tag", "Nr.", "Gericht", "Caterer"];
    const rows = orders.map(o => [
      o.first_name,
      o.last_name,
      o.location,
      o.iso_week,
      typeof o.day_of_week === "number"
        ? WEEKDAYS[o.day_of_week]
        : WEEKDAYS[Number(o.day_of_week)] ?? "",
      o.menu_number,
      o.description,
      o.caterer_id ? CATERER_OPTIONS[o.caterer_id] ?? o.caterer_id : ""
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bestellungen_KW${isoWeek}_${isoYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePdfExport() {
    setLoadingPdf(true);
    try {
      const res = await fetch(
        `/api/export-orders?isoWeek=${isoWeek}&isoYear=${isoYear}&day=${selectedDay}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PDF_Export_KW${isoWeek}_${isoYear}_Tag${selectedDay}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className="space-y-4 w-full justify-between overflow-x-auto">
      {/* Buttons on a single line */}
      <div className="flex space-x-2 mb-3">
        <h2 className="text-lg font-bold text-[#0056b3] dark:text-blue-200">
          Bestellungen Übersicht <span className="font-normal text-gray-500 dark:text-gray-400">(KW {isoWeek}/{isoYear})</span>
        </h2>
        </div>
          {/* Fieldset direkt unter der Überschrift */}
  <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-4 mb-6">
    <legend className="px-2 text-xs font-semibold text-blue-600 dark:text-blue-300">
      Export-Optionen
    </legend>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Label + Select */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="daySelect"
          className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
        >
          Wochentag:
        </label>
        <select
          id="daySelect"
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          className="text-sm px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
        >
          {Object.entries(WEEKDAYS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition text-xs"
        >
          Export - CSV
        </button>

        <button
          onClick={handlePdfExport}
          disabled={loadingPdf}
          className={`
            bg-purple-600 hover:bg-purple-700 text-white
            px-3 py-1.5 rounded-full shadow font-semibold
            transition text-xs flex items-center gap-2
            ${loadingPdf ? 'opacity-70 cursor-wait' : ''}
          `}
        >
          {loadingPdf ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Lädt…
            </>
          ) : (
            'Export - Aushänge'
          )}
        </button>
      </div>
    </div>
  </fieldset>
      {/* ─── Übersicht Bestellmengen ───────────────────────────────────────────────── */}
      {!loading && (
        <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-gray-900 rounded-xl shadow-sm border border-blue-100 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-[#0056b3] dark:text-blue-200 mb-1">
            Übersicht Bestellmengen für {WEEKDAYS[selectedDay]}:
          </h3>
          <ul className="text-xs text-gray-800 dark:text-gray-200 list-disc pl-5 space-y-1">
            {Object.entries(
              orders
                .filter(o => Number(o.day_of_week) === selectedDay)
                .reduce<Record<string, { count: number; description: string }>>((acc, order) => {
                  const key = String(order.menu_number);
                  if (!acc[key]) {
                    acc[key] = { count: 1, description: order.description };
                  } else {
                    acc[key].count += 1;
                  }
                  return acc;
                }, {})
            ).map(([menuNr, { count, description }]) => (
              <li key={menuNr}>
                <strong>{count}× bestellt</strong> Men&uuml; {menuNr} – {description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-base dark:text-gray-100 dark:bg-gray-900">Lädt...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 dark:border-gray-700 shadow bg-white dark:bg-gray-800">
          <table className="min-w-full divide-y divide-blue-100 dark:divide-gray-700 text-xs">
            <thead>
              <tr className="bg-blue-50 dark:bg-gray-900">
                {["Vorname", "Nachname", "Standort", "KW", "Tag", "Nr.", "Gericht", "Caterer"].map((col) => (
                  <th key={col} className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.first_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.last_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.location}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.iso_week}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {typeof o.day_of_week === "number"
                      ? WEEKDAYS[o.day_of_week]
                      : WEEKDAYS[Number(o.day_of_week)] ?? ""}
                  </td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.menu_number}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.description}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {o.caterer_id ? CATERER_OPTIONS[o.caterer_id] ?? o.caterer_id : ""}
                  </td>
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
