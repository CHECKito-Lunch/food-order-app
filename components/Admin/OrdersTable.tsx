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
  backup_first_name: string | null;
  backup_last_name: string | null;
  location: string;
  iso_week: number | string;
  day_of_week: number | string;
  menu_number: number | string;
  description: string;
  caterer_id: number | null;
}

export default function OrdersTable({ isoYear, isoWeek }: { isoYear: number; isoWeek: number }) {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Ensure DB columns: backup_first_name, backup_last_name on orders
  // ALTER TABLE orders ADD COLUMN backup_first_name TEXT;
  // ALTER TABLE orders ADD COLUMN backup_last_name TEXT;

  // Fetch orders for the selected week
  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, first_name, last_name, backup_first_name, backup_last_name, location, week_menu_id, 
         week_menus (menu_number, description, caterer_id, day_of_week, iso_week, iso_year)`
      )
      .eq('week_menus.iso_week', isoWeek)
      .eq('week_menus.iso_year', isoYear);

    if (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } else {
      const formatted: OrderAdmin[] = (data ?? [])
        .filter((row: any) => row.week_menus?.menu_number)
        .map((row: any) => ({
          id: row.id,
          first_name: row.first_name || "",
          last_name: row.last_name || "",
          backup_first_name: row.backup_first_name,
          backup_last_name: row.backup_last_name,
          location: row.location || "",
          iso_week: row.week_menus.iso_week,
          day_of_week: row.week_menus.day_of_week,
          menu_number: row.week_menus.menu_number,
          description: row.week_menus.description,
          caterer_id: row.week_menus.caterer_id,
        }));
      setOrders(formatted);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
  }, [isoYear, isoWeek]);

  // Export CSV
  function exportCSV() {
    const header = [
      "Vorname",
      "Nachname",
      "Standort",
      "KW",
      "Tag",
      "Nr.",
      "Gericht",
      "Caterer",
    ];
    const rows = orders.map(o => [
      o.first_name,
      o.last_name,
      o.location,
      o.iso_week,
      typeof o.day_of_week === 'number' ? WEEKDAYS[o.day_of_week] : WEEKDAYS[Number(o.day_of_week)] || '',
      o.menu_number,
      o.description,
      o.caterer_id ? CATERER_OPTIONS[o.caterer_id] || '' : '',
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bestellungen_KW${isoWeek}_${isoYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export PDF bundle
  async function handlePdfExport() {
    setLoadingPdf(true);
    try {
      const res = await fetch(
        `/api/export-orders?isoWeek=${isoWeek}&isoYear=${isoYear}&day=${selectedDay}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PDF_Export_KW${isoWeek}_${isoYear}_Tag${selectedDay}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    } finally {
      setLoadingPdf(false);
    }
  }

  // Release (sick employee) with backup
  async function handleRelease(orderId: number) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const { error } = await supabase
      .from('orders')
      .update({
        backup_first_name: order.first_name,
        backup_last_name: order.last_name,
        first_name: 'freigegeben',
        last_name: ''
      })
      .eq('id', orderId);
    if (error) {
      console.error('Error releasing order:', error);
      return;
    }
    fetchOrders();
  }

  // Undo release using backup
  async function handleUndo(orderId: number) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const { error } = await supabase
      .from('orders')
      .update({
        first_name: order.backup_first_name || '',
        last_name: order.backup_last_name || '',
        backup_first_name: null,
        backup_last_name: null
      })
      .eq('id', orderId);
    if (error) {
      console.error('Error undoing release:', error);
      return;
    }
    fetchOrders();
  }

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const text = `${o.first_name} ${o.last_name} ${o.location}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4 w-full overflow-x-auto">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:justify-between mb-4">
        <h2 className="text-lg font-bold text-[#0056b3] dark:text-blue-200">
          Bestellungen Übersicht <span className="font-normal text-gray-500 dark:text-gray-400">(KW {isoWeek}/{isoYear})</span>
        </h2>
        <input
          type="text"
          placeholder="Suchen nach Name oder Standort..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="mt-2 sm:mt-0 px-2 py-1 border border-blue-200 dark:border-gray-700 rounded bg-white shadow-sm text-sm w-full sm:w-64"
        />
      </div>

      {/* Export Options */}
      <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <legend className="px-2 text-xs font-semibold text-blue-600 dark:text-blue-300">Export-Optionen</legend>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="daySelect" className="text-sm font-medium text-gray-700 dark:text-gray-300">Wochentag:</label>
            <select
              id="daySelect"
              value={selectedDay}
              onChange={e => setSelectedDay(Number(e.target.value))}
              className="text-sm px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
            >
              {Object.entries(WEEKDAYS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition text-xs">Export - CSV</button>
            <button
              onClick={handlePdfExport}
              disabled={loadingPdf}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition text-xs"
            >{loadingPdf ? 'Lädt…' : 'Export - Aushänge'}</button>
          </div>
        </div>
      </fieldset>

      {!loading ? (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 dark:border-gray-700 shadow bg-white dark:bg-gray-800">
          <table className="min-w-full divide-y divide-blue-100 dark:divide-gray-700 text-xs">
            <thead>
              <tr className="bg-blue-50 dark:bg-gray-900">
                {['Vorname','Nachname','Standort','KW','Tag','Nr.','Gericht','Caterer','Aktion'].map(col => (
                  <th key={col} className="p-2 font-semibold text-[#0056b3] dark:text-blue-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.first_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.last_name}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.location}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.iso_week}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {typeof o.day_of_week === 'number' ? WEEKDAYS[o.day_of_week] : WEEKDAYS[Number(o.day_of_week)] || ''}
                  </td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.menu_number}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.description}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">{o.caterer_id ? CATERER_OPTIONS[o.caterer_id] || '' : ''}</td>
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700">
                    {o.first_name === 'freigegeben' ? (
                      <button
                        onClick={() => handleUndo(o.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-full text-xs"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRelease(o.id)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded-full text-xs"
                      >
                        Freigeben
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500 dark:text-gray-400">Keine Bestellungen gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-base dark:text-gray-100">Lädt...</div>
      )}
    </div>
  );
}
