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
const LOCATIONS = ["Südpol", "Nordpol"];

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
interface WeekMenuOption {
  id: number;
  menu_number: number;
}

export default function OrdersTable({ isoYear, isoWeek }: { isoYear: number; isoWeek: number }) {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // For Nachtrag form
  const [weekMenuOptions, setWeekMenuOptions] = useState<WeekMenuOption[]>([]);
  const [newOrder, setNewOrder] = useState({ first_name: '', last_name: '', location: LOCATIONS[0], week_menu_id: 0 as number });

  // Fetch orders & menu options
  async function fetchData() {
    setLoading(true);
    const { data: ordData, error: ordErr } = await supabase
      .from('orders')
      .select(`
        id, first_name, last_name, backup_first_name, backup_last_name, location, week_menu_id,
        week_menus (menu_number, description, caterer_id, day_of_week, iso_week, iso_year)
      `)
      .eq('week_menus.iso_week', isoWeek)
      .eq('week_menus.iso_year', isoYear);
    if (ordErr) {
      console.error('Error fetching orders:', ordErr);
      setOrders([]);
    } else {
      setOrders(
        (ordData ?? [])
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
          }))
      );
    }
    // fetch menu options for selected day
    const { data: menuData, error: menuErr } = await supabase
      .from('week_menus')
      .select('id, menu_number')
      .eq('iso_week', isoWeek)
      .eq('iso_year', isoYear)
      .eq('day_of_week', selectedDay);
    if (menuErr) console.error('Error fetching menu options:', menuErr);
    else setWeekMenuOptions(menuData || []);

    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [isoYear, isoWeek, selectedDay]);

// Gibt das Datum für ISO-Woche `w`, ISO-Jahr `y` und Wochentag `day` (1=Mo … 7=So) zurück
function getDateOfISOWeek(w: number, y: number, day: number) {
  // Erster Tag der ISO-Woche 1
  const simple = new Date(y, 0, 1 + (w - 1) * 7);
  const dow = simple.getDay() || 7;       // Sonntag als 7
  const isoWeekStart = new Date(simple);
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - (dow - 1));
  } else {
    isoWeekStart.setDate(simple.getDate() + (8 - dow));
  }
  // jetzt den gewünschten Wochentag hinzufügen
  isoWeekStart.setDate(isoWeekStart.getDate() + (day - 1));
  return isoWeekStart;
}
  // Export CSV
  function exportCSV() { /* unchanged */ }
  async function handlePdfExport() { /* unchanged */ }
  async function handleRelease(orderId: number) { /* unchanged */ }
  async function handleUndo(orderId: number) { /* unchanged */ }

// Delete single order
  async function handleDelete(orderId: number) {
    const confirmDel = window.confirm('Soll diese Bestellung wirklich gelöscht werden?');
    if (!confirmDel) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) console.error('Error deleting order:', error);
    else fetchData();
  }

  // Delete all for selected day
  async function handleDeleteAll() {
    const confirmDel = window.confirm(`Alle Bestellungen für ${WEEKDAYS[selectedDay]} wirklich löschen?`);
    if (!confirmDel) return;
    const ids = orders.filter(o => Number(o.day_of_week) === selectedDay).map(o => o.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('orders').delete().in('id', ids);
    if (error) console.error('Error deleting all orders:', error);
    else fetchData();
  }
  // Add Nachtrag
  async function handleAddOrder() {
    if (!newOrder.week_menu_id) return;
    const { error } = await supabase
      .from('orders')
      .insert([{ ...newOrder }]);
    if (error) { console.error('Error adding order:', error); return; }
    setNewOrder({ first_name: '', last_name: '', location: LOCATIONS[0], week_menu_id: weekMenuOptions[0]?.id || 0 });
    fetchData();
  }

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = `${o.first_name} ${o.last_name} ${o.location}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDay = Number(o.day_of_week) === selectedDay;
    return matchesSearch && matchesDay;
  });

  // Build summary counts
  const selectedDate = getDateOfISOWeek(isoWeek, isoYear, selectedDay);
  const summary = filteredOrders.reduce<Record<string, { count: number; description: string }>>((acc, o) => {
    const key = o.menu_number.toString();
    if (!acc[key]) acc[key] = { count: 1, description: o.description };
    else acc[key].count++;
    return acc;
  }, {});

  return (
    <div className="space-y-4 w-full overflow-x-auto">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:justify-between mb-4">
        <h2 className="text-lg font-bold text-[#0056b3]">{`Bestellübersicht (KW ${isoWeek}/${isoYear})`}</h2>
        <input
          type="text"
          placeholder="Suchen nach Name oder Standort..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border border-blue-200 mt-2 sm:mt-0 px-2 py-1 px-2 py-1 dark:border-gray-700 bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm w-full sm:w-64"
        />
      </div>

     {/* Bestellung nachtragen */}
      <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-4 mb-6 bg-white dark:bg-gray-900">
        <legend className="px-2 text-xs font-semibold text-[#0056b3] dark:text-blue-300">Bestellung nachtragen für {selectedDate.toLocaleDateString('de-DE')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <input
            type="text"
            placeholder="Vorname"
            value={newOrder.first_name}
            onChange={e => setNewOrder(n => ({ ...n, first_name: e.target.value }))}
            className="border border-blue-200 px-2 py-1 dark:border-gray-700 bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="Nachname"
            value={newOrder.last_name}
            onChange={e => setNewOrder(n => ({ ...n, last_name: e.target.value }))}
            className="border border-blue-200 px-2 py-1 dark:border-gray-700 bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={newOrder.location}
            onChange={e => setNewOrder(n => ({ ...n, location: e.target.value }))}
            className="border border-blue-200 px-2 py-1 dark:border-gray-700 bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <select
            value={newOrder.week_menu_id}
            onChange={e => setNewOrder(n => ({ ...n, week_menu_id: Number(e.target.value) }))}
            className="border border-blue-200 px-2 py-1 dark:border-gray-700 bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {weekMenuOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.menu_number}</option>)}
          </select>
          <button
            onClick={handleAddOrder}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition text-xs"
          >
            Hinzufügen
          </button>
        </div>
      </fieldset>

      {/* Wochen Options */}
      <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <legend className="px-2 text-xs font-semibold text-[#0056b3] dark:text-blue-300">Wochen-Optionen</legend>
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
            <button onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-full shadow font-semibold transition text-xs">Alle Bestellungen löschen</button>
          </div>
        </div>
      </fieldset>

      {/* Summary for selected day */}
      <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-gray-900 rounded-xl shadow-sm border border-blue-100 dark:border-gray-700">
        <h3 className="font-semibold text-sm text-[#0056b3] dark:text-blue-200 mb-1">Übersicht Bestellmengen für {selectedDate.toLocaleDateString('de-DE')}:</h3>
        <ul className="text-xs text-gray-800 dark:text-gray-200 list-disc pl-5 space-y-1">
          {Object.entries(summary).map(([menuNr, { count, description }]) => (
            <li key={menuNr}><strong>{count}×</strong> – {description}</li>
          ))}
          {Object.keys(summary).length === 0 && <li>Keine Bestellungen für diesen Tag.</li>}
        </ul>
        
      </div>

      {/* Orders Table */}
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
                  <td className="p-2 border-t border-blue-100 dark:border-gray-700 flex space-x-2">
                    {o.first_name === 'freigegeben'       ?<button onClick={()=>handleUndo(o.id)} className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">Undo</button>
                      :<button onClick={()=>handleRelease(o.id)} className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">Freigeben</button>}
                    <button onClick={()=>handleDelete(o.id)} className="bg-red-600 text-white px-2 py-1 rounded-full text-xs">Löschen</button>
                      
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
