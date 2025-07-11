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

  // Menü bearbeiten
  const handleMenuChange = (d: number, idx: number, changes: Partial<Menu>) => {
    pushUndo();
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

  // <<< NEU: Woche leeren (ALLE Menüs + Orders der Woche löschen) >>>
  const handleClearWeek = async () => {
    if (!window.confirm('Willst du wirklich die ganze Woche löschen? Alle Menüs und zugehörige Bestellungen dieser Woche werden entfernt!')) return;
    
    // 1. Menü-IDs dieser Woche holen
    const { data: menusToDelete, error: menuLoadError } = await supabase
      .from('week_menus')
      .select('id')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek);

    if (menuLoadError) {
      alert('Fehler beim Laden der Menüs: ' + menuLoadError.message);
      return;
    }

    const menuIds = (menusToDelete ?? []).map((m: any) => m.id);

    // 2. Orders löschen (wenn es welche gibt)
    if (menuIds.length > 0) {
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('week_menu_id', menuIds);
      if (ordersError) {
        alert('Fehler beim Löschen der Bestellungen: ' + ordersError.message);
        return;
      }
    }

    // 3. Menüs löschen
    const { error: menusError } = await supabase
      .from('week_menus')
      .delete()
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek);

    if (menusError) {
      alert('Fehler beim Löschen der Menüs: ' + menusError.message);
      return;
    }
    setMenus({ 1: [], 2: [], 3: [], 4: [], 5: [] });
    setUndoStack([]);
    alert('Woche wurde komplett geleert!');
    reloadMenus();
  };

  // Preset speichern (Deadlines nicht mitspeichern!)
  const handleSavePreset = async () => {
    if (!presetName) return alert("Bitte Preset-Namen eingeben!");
    const cleanMenus: MenuPerDay = {};
    Object.entries(menus).forEach(([d, arr]) => {
      cleanMenus[Number(d)] = arr.map(m => ({
        ...m,
        order_deadline: '' // explizit leeren!
      }));
    });
    const presetData = { name: presetName, menus: JSON.stringify(cleanMenus) };
    const { error } = await supabase.from('week_menu_presets').insert(presetData);
    if (!error) {
      setPresetName('');
      alert("Preset gespeichert!");
      const { data } = await supabase.from('week_menu_presets').select('*');
      setPresets((data || []).map((p: any) => ({
        ...p,
        menus: typeof p.menus === 'string' ? JSON.parse(p.menus) : p.menus
      })));
    }
  };

  // Preset laden (Deadlines leer setzen!)
  const handleTryLoadPreset = () => {
    if (!selectedPresetId) return;
    setConfirm({ action: "load-preset", payload: selectedPresetId });
  };
  const handleLoadPreset = () => {
    if (!selectedPresetId) return;
    const preset = presets.find(p => p.id === selectedPresetId);
    if (preset) {
      pushUndo();
      const loadedMenus: MenuPerDay = {};
      Object.entries(preset.menus).forEach(([d, arr]) => {
        loadedMenus[Number(d)] = arr.map(m => ({
          ...m,
          order_deadline: ''
        }));
      });
      setMenus(loadedMenus);
    }
    setConfirm(null);
  };

  // Preset umbenennen
  const handleEditPresetName = (id: number, name: string) => {
    setEditPresetId(id);
    setEditPresetName(name);
  };
  const handleSavePresetName = async () => {
    if (!editPresetId || !editPresetName) return;
    await supabase.from('week_menu_presets').update({ name: editPresetName }).eq('id', editPresetId);
    setEditPresetId(null);
    setEditPresetName('');
    const { data } = await supabase.from('week_menu_presets').select('*');
    setPresets((data || []).map((p: any) => ({
      ...p,
      menus: typeof p.menus === 'string' ? JSON.parse(p.menus) : p.menus
    })));
  };

  // Preset löschen (mit Bestätigung)
  const handleTryDeletePreset = (id: number) => setConfirm({ action: "delete-preset", payload: id });
  const handleDeletePreset = async () => {
    if (!confirm?.payload) return;
    await supabase.from('week_menu_presets').delete().eq('id', confirm.payload);
    setConfirm(null);
    const { data } = await supabase.from('week_menu_presets').select('*');
    setPresets((data || []).map((p: any) => ({
      ...p,
      menus: typeof p.menus === 'string' ? JSON.parse(p.menus) : p.menus
    })));
  };

  // Export als CSV
  const exportCSV = () => {
    const csvRows: string[] = [
      "Tag,Menü-Nr.,Bezeichnung,Caterer,Deadline"
    ];
    Object.entries(WEEKDAYS).forEach(([d, dayName]) => {
      (menus[Number(d)] || []).forEach(m => {
        const caterer = CATERER_OPTIONS.find(c => c.id === m.caterer_id)?.name || '';
        csvRows.push([
          dayName,
          m.menu_number,
          m.description.replace(/"/g, "'"),
          caterer,
          m.order_deadline
        ].map(val => `"${val}"`).join(","));
      });
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `essensplan_kw${isoWeek}_${isoYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Confirm Modal ---
  const ConfirmModal = () => (
    confirm && (
      <div className="fixed inset-0 z-30 bg-black bg-opacity-40 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg min-w-[220px] text-center border border-blue-100 dark:border-gray-700">
          {confirm.action === "delete-preset" && (
            <>
              <p className="mb-2 text-gray-900 dark:text-gray-100 text-sm">Preset wirklich <b>löschen</b>?</p>
              <button className="bg-red-600 text-white px-2 py-1 rounded-full font-semibold mr-2 hover:bg-red-700 text-xs shadow" onClick={handleDeletePreset}>Löschen</button>
              <button className="bg-gray-200 dark:bg-gray-900 dark:text-gray-100 px-2 py-1 rounded-full font-semibold text-xs" onClick={() => setConfirm(null)}>Abbrechen</button>
            </>
          )}
          {confirm.action === "load-preset" && (
            <>
              <p className="mb-2 text-gray-900 dark:text-gray-100 text-sm">Preset wirklich <b>laden</b>?<br /><span className="text-xs text-gray-500 dark:text-gray-400">(Alle aktuellen Menüs werden überschrieben!)</span></p>
              <button className="bg-green-600 text-white px-2 py-1 rounded-full font-semibold mr-2 hover:bg-green-700 text-xs shadow" onClick={handleLoadPreset}>Preset laden</button>
              <button className="bg-gray-200 dark:bg-gray-900 dark:text-gray-100 px-2 py-1 rounded-full font-semibold text-xs" onClick={() => setConfirm(null)}>Abbrechen</button>
            </>
          )}
        </div>
      </div>
    )
  );

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold mb-1 text-[#0056b3] dark:text-blue-200">Menü KW {isoWeek}/{isoYear}</h2>

      {/* Reload Button */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={reloadMenus}
          className="bg-blue-500 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-full text-xs shadow transition"
        >
          Menüs neu laden
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Letztes Laden: {reloadTime}
        </span>
      </div>

      {/* Preset Bar */}
      <div className="flex flex-wrap gap-1 mb-2">
        <input
          value={presetName}
          onChange={e => setPresetName(e.target.value)}
          placeholder="Preset-Name"
          className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSavePreset}
          className="bg-[#0056b3] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-2 py-1 rounded-full text-xs shadow transition"
        >
          Preset speichern
        </button>
        <select
          value={selectedPresetId || ""}
          onChange={e => setSelectedPresetId(Number(e.target.value))}
          className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Preset wählen…</option>
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          onClick={handleTryLoadPreset}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-2 py-1 rounded-full text-xs shadow transition"
        >
          Preset laden
        </button>
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="bg-yellow-400 text-black font-semibold px-2 py-1 rounded-full text-xs shadow transition disabled:bg-yellow-200"
        >
          Undo
        </button>
        <button
          onClick={exportCSV}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-2 py-1 rounded-full text-xs shadow transition"
        >
          Export als CSV
        </button>
      </div>

      {/* --- NEU: Menüs Rendern pro Tag --- */}
      <div className="space-y-4">
        {Object.entries(WEEKDAYS).map(([d, name]) => (
          <div key={d} className="border border-blue-100 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-[#0056b3] dark:text-blue-200">{name}</div>
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

      <div className="flex justify-end mt-3 gap-2">
        <button
          onClick={handleClearWeek}
          className="bg-red-700 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow transition"
        >
          Woche leeren
        </button>
        <button
          onClick={handleSave}
          className="bg-green-700 hover:bg-green-800 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow transition"
        >
          Woche speichern
        </button>
      </div>

      <ConfirmModal />
    </div>
  );
}
