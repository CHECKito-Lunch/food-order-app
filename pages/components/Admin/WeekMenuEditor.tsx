import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const CATERER_OPTIONS = [
  { id: 1, name: 'Dean&David' },
  { id: 2, name: 'Merkel' },
  { id: 3, name: 'Bloi' },
];

const WEEKDAYS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag'
};

type Menu = {
  id?: number;
  menu_number: number;
  description: string;
  caterer_id: number;
  order_deadline: string;
};

type MenuPerDay = {
  [day: number]: Menu[];
};

type Preset = {
  id: number;
  name: string;
  menus: MenuPerDay;
};

// Hilfsfunktion: Datum für jeweiligen Wochentag und Kalenderwoche berechnen
function getDateOfISOWeek(week: number, year: number, weekday: number) {
  // weekday: 1=Montag...7=Sonntag
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  let ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  const result = new Date(ISOweekStart);
  result.setDate(ISOweekStart.getDate() + (weekday - 1));
  return result;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WeekMenuEditor({ isoYear, isoWeek }: { isoYear: number; isoWeek: number }) {
  const [menus, setMenus] = useState<MenuPerDay>({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const [undoStack, setUndoStack] = useState<MenuPerDay[]>([]);
  const [copiedDay, setCopiedDay] = useState<number | null>(null);
  const [pasteTarget, setPasteTarget] = useState<number>(1);

  // Presets
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [editPresetId, setEditPresetId] = useState<number | null>(null);
  const [editPresetName, setEditPresetName] = useState('');
  const [confirm, setConfirm] = useState<{ action: string, payload?: any } | null>(null);

  // Reload-Time State
  const [reloadTime, setReloadTime] = useState('');

  // --- Menü-Laden ausgelagert ---
  const reloadMenus = async () => {
    const { data: loaded, error } = await supabase
      .from('week_menus')
      .select('*')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek);

    const grouped: MenuPerDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (loaded || []).forEach((m: any) => {
      const day = Number(m.day_of_week);
      if (grouped[day]) {
        grouped[day].push({
          ...m,
          order_deadline: m.order_deadline
            ? new Date(m.order_deadline).toISOString().slice(0, 16)
            : ''
        });
      }
    });
    setMenus(grouped);
    setUndoStack([]);
    setReloadTime(new Date().toLocaleTimeString('de-DE'));
  };

  // Initiales Laden
  useEffect(() => {
    reloadMenus();
    supabase.from('week_menu_presets').select('*').then(r => {
      setPresets((r.data || []).map((p: any) => ({
        ...p,
        menus: typeof p.menus === 'string' ? JSON.parse(p.menus) : p.menus
      })));
    });
  }, [isoYear, isoWeek]);

  function pushUndo() {
    setUndoStack(s => [...s.slice(-9), JSON.parse(JSON.stringify(menus))]);
  }
  function handleUndo() {
    if (!undoStack.length) return;
    setMenus(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  }

  // Menü hinzufügen für Tag d
  const handleAddMenu = (d: number) => {
    pushUndo();
    setMenus(prev => ({
      ...prev,
      [d]: [
        ...prev[d],
        {
          menu_number: prev[d].length + 1,
          description: '',
          caterer_id: CATERER_OPTIONS[0].id,
          order_deadline: '' // Leeres Feld
        }
      ]
    }));
  };

  // Menü entfernen
  const handleRemoveMenu = (d: number, idx: number) => {
    pushUndo();
    setMenus(prev => ({
      ...prev,
      [d]: prev[d].filter((_, i) => i !== idx)
    }));
  };

  // Automatische Bestellfrist bei Caterer-Änderung
  function getDefaultDeadlineForCaterer(caterer_id: number, day: number) {
    const jsDay = day;
    const menuDate = getDateOfISOWeek(isoWeek, isoYear, jsDay);
    let deadlineDate;
    if (caterer_id === 1) { // Dean&David
      deadlineDate = new Date(menuDate);
      deadlineDate.setDate(menuDate.getDate() - 7);
      deadlineDate.setHours(12, 0, 0, 0);
    } else { // Merkel/Bloi
      deadlineDate = new Date(menuDate);
      deadlineDate.setDate(menuDate.getDate() - 1);
      deadlineDate.setHours(12, 0, 0, 0);
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${deadlineDate.getFullYear()}-${pad(deadlineDate.getMonth() + 1)}-${pad(deadlineDate.getDate())}T${pad(deadlineDate.getHours())}:00`;
  }

  // Menü bearbeiten
  const handleMenuChange = (d: number, idx: number, changes: Partial<Menu>) => {
    pushUndo();
    if (changes.caterer_id !== undefined) {
      const newDeadline = getDefaultDeadlineForCaterer(changes.caterer_id, d);
      changes.order_deadline = newDeadline;
    }
    setMenus(prev => ({
      ...prev,
      [d]: prev[d].map((m, i) => i === idx ? { ...m, ...changes } : m)
    }));
  };

  // Copy/Paste für Tages-Arrays
  const handleCopyDay = (d: number) => { setCopiedDay(d); setPasteTarget(d); };
  const handlePasteDay = () => {
    if (!copiedDay) return;
    pushUndo();
    setMenus(prev => ({
      ...prev,
      [pasteTarget]: prev[copiedDay].map(m => ({
        ...m,
        order_deadline: '' // Deadline wird geleert!
      }))
    }));
    setCopiedDay(null);
  };

  // Speichern/Upsert (Bestellfristen bleiben erhalten!)
  const handleSave = async () => {
    const allMenus = Object.entries(menus).flatMap(([d, arr]) =>
      arr.map(m => ({
        ...m,
        day_of_week: Number(d),
        iso_year: isoYear,
        iso_week: isoWeek,
      }))
    );
    const { error } = await supabase
      .from('week_menus')
      .upsert(allMenus, { onConflict: 'id' });
    if (error) {
      alert('Fehler beim Speichern: ' + error.message);
      return;
    }
    alert('Woche gespeichert');
    reloadMenus();
  };

  // --- ConfirmModal, Export etc. bleibt wie gehabt ---
  // ... deinen Modal-Code einfügen, falls genutzt ...

  // --- RENDER ---
  return (
    <div className="space-y-6">
      {/* ... Header, Preset Bar, Buttons ... */}
      <div className="space-y-4">
        {Object.entries(WEEKDAYS).map(([d, name]) => (
          <div key={d} className="border border-blue-100 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-[#0056b3] dark:text-blue-200">
                {name}
                <span className="text-xs text-gray-500 ml-2">
                  {formatDate(getDateOfISOWeek(isoWeek, isoYear, Number(d)))}
                </span>
              </div>
              <button
                onClick={() => handleAddMenu(Number(d))}
                className="bg-[#0056b3] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-2 py-1 rounded-full text-xs shadow transition"
              >
                + Menü
              </button>
            </div>
            <div className="space-y-2">
              {(menus[Number(d)]?.length > 0)
                ? menus[Number(d)].map((m, i) => (
                  <div key={i} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-blue-50 dark:bg-gray-900 px-2 py-2 rounded-lg">
                    <input
                      type="number"
                      value={m.menu_number}
                      onChange={e => handleMenuChange(Number(d), i, { menu_number: Number(e.target.value) })}
                      className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-16 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                    />
                    <input
                      type="text"
                      value={m.description}
                      onChange={e => handleMenuChange(Number(d), i, { description: e.target.value })}
                      className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 flex-1 min-w-[100px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                      placeholder="Bezeichnung"
                    />
                    <select
                      value={m.caterer_id}
                      onChange={e => handleMenuChange(Number(d), i, { caterer_id: Number(e.target.value) })}
                      className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                    >
                      {CATERER_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                      type="datetime-local"
                      value={m.order_deadline}
                      onChange={e => handleMenuChange(Number(d), i, { order_deadline: e.target.value })}
                      className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 w-[170px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                    />
                    <button
                      onClick={() => handleRemoveMenu(Number(d), i)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-2 py-1 rounded-full text-xs shadow transition"
                      title="Menü löschen"
                    >
                      X
                    </button>
                  </div>
                ))
                : <div className="text-xs text-gray-400">Kein Menü für diesen Tag.</div>
              }
            </div>
          </div>
        ))}
      </div>
      {/* ...Restliche Buttons, ConfirmModal... */}
    </div>
  );
}
