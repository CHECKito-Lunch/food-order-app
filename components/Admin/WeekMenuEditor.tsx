import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

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
  is_veggie?: boolean;
  is_vegan?: boolean;
  in_fridge?: boolean;
};

type MenuPerDay = {
  [day: number]: Menu[];
};

type Preset = {
  id: number;
  name: string;
  menus: MenuPerDay;
};

// === Hilfsfunktion: Datum zu Wochentag (Mo–Fr) der ISO-KW berechnen ===
function getDateOfISOWeek(isoWeek: number, isoYear: number, isoWeekday: number): Date {
  const simple = new Date(isoYear, 0, 1 + (isoWeek - 1) * 7);
  const dow = simple.getDay();
  let ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  const result = new Date(ISOweekStart);
  result.setDate(ISOweekStart.getDate() + (isoWeekday - 1));
  return result;
}

function formatDateDE(date: Date) {
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1)
    .toString().padStart(2, '0')}.${date.getFullYear()}`;
}

// === Automatische Deadline je Caterer ===
function getDefaultDeadlineForCaterer(caterer_id: number, isoWeek: number, isoYear: number, day: number) {
  const menuDate = getDateOfISOWeek(isoWeek, isoYear, day);
  let deadlineDate = new Date(menuDate);
  if (caterer_id === 1) { // Dean&David
    deadlineDate.setDate(menuDate.getDate() - 7);
  } else { // Merkel/Bloi
    deadlineDate.setDate(menuDate.getDate() - 1);
  }
  deadlineDate.setHours(10, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${deadlineDate.getFullYear()}-${pad(deadlineDate.getMonth() + 1)}-${pad(deadlineDate.getDate())}T${pad(deadlineDate.getHours())}:00`;
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

    if (error) {
      console.error(error);
      return;
    }

    const grouped: MenuPerDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (loaded || []).forEach((m: any) => {
      const day = Number(m.day_of_week);
      if (grouped[day]) {
        grouped[day].push({
          ...m,
          order_deadline: m.order_deadline ? m.order_deadline.slice(0, 16) : '',
          is_veggie: m.is_veggie,
          is_vegan: m.is_vegan,
          in_fridge: m.in_fridge
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
          order_deadline: '',
          is_veggie: false,
          is_vegan: false,
          in_fridge: false
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

  // Menü bearbeiten (inkl. Automatische Deadline)
  const handleMenuChange = (d: number, idx: number, changes: Partial<Menu>) => {
    pushUndo();

    // Caterer-Wechsel: Deadline setzen
    if (changes.caterer_id !== undefined) {
      changes.order_deadline = getDefaultDeadlineForCaterer(changes.caterer_id, isoWeek, isoYear, d);
    }

    setMenus(prev => ({
      ...prev,
      [d]: prev[d].map((m, i) => i === idx ? { ...m, ...changes } : m)
    }));
  };

  // Copy/Paste für Tages-Arrays
  const handleCopyDay = (d: number) => { setCopiedDay(d); setPasteTarget(d); };
  const handlePasteDay = () => {
    if (copiedDay === null) return;
    pushUndo();
    setMenus(prev => ({
      ...prev,
      [pasteTarget]: prev[copiedDay].map(({ id, ...m }) => ({
        ...m,
        order_deadline: '', // Deadline wird geleert!
        in_fridge: m.in_fridge,
        is_veggie: m.is_veggie,
        is_vegan: m.is_vegan
      }))
    }));
    setCopiedDay(null);
  };

  // =============================
  // SPEICHERN: Menüs synchronisieren,
  // NIE Orders löschen, Menüs nur ohne Orders löschen!
  // =============================
  const handleSave = async () => {
    // 1. Lade alle Menüs der Woche aus der DB
    const { data: dbMenus, error: loadError } = await supabase
      .from('week_menus')
      .select('id')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek);

    if (loadError) {
      alert('Fehler beim Laden der alten Menüs: ' + loadError.message);
      return;
    }

    // 2. IDs der aktuellen Menüs (aus dem State)
    const currentIds = Object.values(menus)
      .flat()
      .map(m => m.id)
      .filter(id => typeof id === 'number' && Number.isFinite(id));

    // 3. Finde alte Menü-IDs, die entfernt wurden
    const idsToDelete = (dbMenus ?? [])
      .map(m => m.id)
      .filter(id => !currentIds.includes(id));

    let deletableMenuIds: number[] = [];
    if (idsToDelete.length > 0) {
      // 4. Prüfe, ob zu diesen Menüs Orders existieren
      const { data: orderCheck, error: orderErr } = await supabase
        .from('orders')
        .select('week_menu_id')
        .in('week_menu_id', idsToDelete);

      if (orderErr) {
        alert('Fehler beim Prüfen der Orders: ' + orderErr.message);
        return;
      }
      const menuIdsWithOrders = new Set((orderCheck ?? []).map(o => o.week_menu_id));
      deletableMenuIds = idsToDelete.filter(id => !menuIdsWithOrders.has(id));
    }

    // 5. Menüs ohne Orders löschen (Orders werden NIE gelöscht!)
    if (deletableMenuIds.length > 0) {
      const { error: delErr } = await supabase
        .from('week_menus')
        .delete()
        .in('id', deletableMenuIds);
      if (delErr) {
        alert('Fehler beim Löschen alter Menüs: ' + delErr.message);
        return;
      }
    }

    // 6. Upsert/Insert Menüs wie gehabt
    const allMenus = Object.entries(menus).flatMap(([d, arr]) =>
      arr.map(m => ({
        day_of_week: Number(d),
        menu_number: m.menu_number,
        description: m.description,
        caterer_id: m.caterer_id,
        order_deadline: m.order_deadline,
        iso_year: isoYear,
        iso_week: isoWeek,
        is_veggie: !!m.is_veggie,
        is_vegan:  !!m.is_vegan,
        in_fridge: !!m.in_fridge,
        ...(typeof m.id === "number" ? { id: m.id } : {})
      }))
    );
    const toInsert = allMenus.filter(menu => !(menu as any).id);
    const toUpdate = allMenus.filter(menu => (menu as any).id);

    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('week_menus')
        .upsert(toUpdate, { onConflict: 'id' });
      if (updateError) {
        alert('Fehler beim Aktualisieren: ' + updateError.message);
        return;
      }
    }
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('week_menus')
        .insert(toInsert);
      if (insertError) {
        alert('Fehler beim Einfügen: ' + insertError.message);
        return;
      }
    }

    alert('Woche gespeichert');
    reloadMenus();
  };

  // Woche leeren (ALLE Menüs löschen, aber Orders NIEMALS löschen! Menüs mit Orders bleiben erhalten)
  const handleClearWeek = async () => {
    if (!window.confirm('Willst du wirklich alle Menüs der Woche löschen? Nur Menüs ohne Bestellungen werden entfernt!')) return;

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
    let deletableMenuIds: number[] = [];
    if (menuIds.length > 0) {
      const { data: orderCheck, error: orderErr } = await supabase
        .from('orders')
        .select('week_menu_id')
        .in('week_menu_id', menuIds);
      if (orderErr) {
        alert('Fehler beim Prüfen der Orders: ' + orderErr.message);
        return;
      }
      const menuIdsWithOrders = new Set((orderCheck ?? []).map(o => o.week_menu_id));
      deletableMenuIds = menuIds.filter(id => !menuIdsWithOrders.has(id));
    }

    if (deletableMenuIds.length > 0) {
      const { error: menusError } = await supabase
        .from('week_menus')
        .delete()
        .in('id', deletableMenuIds);
      if (menusError) {
        alert('Fehler beim Löschen der Menüs: ' + menusError.message);
        return;
      }
    }

    setMenus({ 1: [], 2: [], 3: [], 4: [], 5: [] });
    setUndoStack([]);
    alert('Alle Menüs ohne Bestellungen wurden gelöscht!');
    reloadMenus();
  };

  // Preset speichern (Deadlines nicht mitspeichern!)
  const handleSavePreset = async () => {
    if (!presetName) return alert("Bitte Preset-Namen eingeben!");
    const cleanMenus: MenuPerDay = {};
    Object.entries(menus).forEach(([d, arr]) => {
      cleanMenus[Number(d)] = arr.map(({ id, ...m }) => ({
        ...m,
        order_deadline: ''
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

  // Preset laden (Deadlines leer setzen, KEINE id übernehmen!)
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
        loadedMenus[Number(d)] = arr.map(({ id, ...m }) => ({
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
    const header = ["Tag","Datum","Nr.","Bezeichnung","Caterer","Deadline","Veggie","Vegan","Kühlschrank"];
    const rows = Object.entries(WEEKDAYS).flatMap(([d, dayName]) => {
      const date = formatDateDE(getDateOfISOWeek(isoWeek, isoYear, Number(d)));
      return (menus[Number(d)]||[]).map(m => [
        dayName,
        date,
        m.menu_number.toString(),
        m.description.replace(/"/g, "'"),
        CATERER_OPTIONS.find(c=>c.id===m.caterer_id)?.name||'',
        m.order_deadline,
        m.is_veggie?'ja':'nein',
        m.is_vegan?'ja':'nein',
        m.in_fridge?'ja':'nein'
      ]);
    });
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `essensplan_kw${isoWeek}_${isoYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Neu: Button um Bestellfristen für alle Menüs neu zu setzen ---
  const handleReloadDeadlines = () => {
    pushUndo();
    setMenus(prev => {
      const newMenus: MenuPerDay = { ...prev };
      Object.keys(newMenus).forEach(d => {
        newMenus[+d] = newMenus[+d].map(m => ({
          ...m,
          order_deadline: getDefaultDeadlineForCaterer(m.caterer_id, isoWeek, isoYear, +d)
        }));
      });
      return newMenus;
    });
  };

  // --- Confirm Modal ---
  const ConfirmModal = () => (
    confirm && (
      <div className="fixed inset-0 z-30 bg-black bg-opacity-40 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg min-w-[220px] text-center border border-blue-100 dark:border-gray-700">
          {confirm.action === "delete-preset" && (
            <>
              <p className="mb-2 text-gray-900 dark:text-gray-100 text-sm">
                Preset wirklich <b>löschen</b>?
              </p>
              <button
                className="bg-red-600 text-white px-2 py-1 rounded-full mr-2 text-xs"
                onClick={handleDeletePreset}
              >
                Löschen
              </button>
              <button
                className="bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded-full text-xs"
                onClick={() => setConfirm(null)}
              >
                Abbrechen
              </button>
            </>
          )}
          {confirm.action === "load-preset" && (
            <>
              <p className="mb-2 text-gray-900 dark:text-gray-100 text-sm">
                Preset wirklich <b>laden</b>?<br/>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  (Alle aktuellen Menüs werden überschrieben!)
                </span>
              </p>
              <button
                className="bg-green-600 text-white px-2 py-1 rounded-full mr-2 text-xs"
                onClick={handleLoadPreset}
              >
                Laden
              </button>
              <button
                className="bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded-full text-xs"
                onClick={() => setConfirm(null)}
              >
                Abbrechen
              </button>
            </>
          )}
        </div>
      </div>
    )
  );

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold mb-1 text-[#0056b3] dark:text-blue-200">
        Menü KW {isoWeek}/{isoYear}
      </h2>

      {/* Reload & Actions */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button
          onClick={reloadMenus}
          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs shadow"
        >
          Menüs neu laden
        </button>
        <button
          onClick={exportCSV}
          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-full text-xs shadow"
        >
          📤 CSV Export
        </button>
        <button
          onClick={handleReloadDeadlines}
          className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-full text-xs shadow"
        >
          ⏰ Fristen setzen
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Letztes Laden: {reloadTime}
        </span>
      </div>

      {/* Presets */}
      <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-3 mb-3">
        <legend className="px-2 text-xs font-semibold text-blue-600 dark:text-blue-300">
          Presets
        </legend>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="Neues Preset benennen"
            className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            onClick={handleSavePreset}
            className="bg-[#0056b3] hover:bg-blue-800 text-white px-2 py-1 rounded-full text-xs shadow"
          >
            💾 Speichern
          </button>
          <select
            value={selectedPresetId ?? ''}
            onChange={e => setSelectedPresetId(Number(e.target.value))}
            className="border border-blue-200 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">Preset wählen…</option>
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleTryLoadPreset}
            disabled={!selectedPresetId}
            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-full text-xs shadow disabled:opacity-50"
          >
            📥 Laden
          </button>
          <button
            onClick={() => selectedPresetId && handleTryDeletePreset(selectedPresetId)}
            disabled={!selectedPresetId}
            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-full text-xs shadow disabled:opacity-50"
          >
            🗑️ Löschen
          </button>
          {editPresetId ? (
            <>
              <input
                value={editPresetName}
                onChange={e => setEditPresetName(e.target.value)}
                placeholder="Neuer Name"
                className="border border-yellow-300 dark:border-yellow-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleSavePresetName}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-full text-xs shadow"
              >
                💾
              </button>
              <button
                onClick={() => { setEditPresetId(null); setEditPresetName(''); }}
                className="bg-gray-300 hover:bg-gray-400 text-black px-2 py-1 rounded-full text-xs shadow"
              >
                ✖️
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                const p = presets.find(p => p.id === selectedPresetId);
                if (p) handleEditPresetName(p.id, p.name);
              }}
              disabled={!selectedPresetId}
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-2 py-1 rounded-full text-xs shadow disabled:opacity-50"
            >
              ✏️ Umbenennen
            </button>
          )}
          <button
            onClick={handleUndo}
            disabled={!undoStack.length}
            className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-black dark:text-white px-2 py-1 rounded-full text-xs shadow disabled:opacity-50"
          >
            ↩️ Undo
          </button>
        </div>
      </fieldset>

 {/* Menüs Rendern pro Tag (mit Datum neben Wochentag) */}
      <div className="space-y-4">
        {Object.entries(WEEKDAYS).map(([d, name]) => {
          const tagDatum = formatDateDE(getDateOfISOWeek(isoWeek, isoYear, Number(d)));
          return (
            <div key={d} className="border border-blue-100 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-[#0056b3] dark:text-blue-200">
                  {name} <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{tagDatum}</span>
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
                        <label className="flex items-center gap-1 text-xs text-green-600">
    <input
      type="checkbox"
      checked={!!m.is_veggie}
      onChange={e => handleMenuChange(Number(d), i, { is_veggie: e.target.checked })}
      className="w-4 h-4 accent-green-500"
      title="Vegetarisch"
    />
    🥦 Veggie
  
  </label>
  <label className="flex items-center gap-1 text-xs text-teal-700">
    <input
      type="checkbox"
      checked={!!m.is_vegan}
      onChange={e => handleMenuChange(Number(d), i, { is_vegan: e.target.checked })}
      className="w-4 h-4 accent-teal-500"
      title="Vegan"
    />
    🌱 Vegan
  </label>
<label className="flex items-center text-xs">
                  <input
                    type="checkbox"
                    checked={!!m.in_fridge}
                    onChange={e =>
                      handleMenuChange(Number(d), i, { in_fridge: e.target.checked })
                    }
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="ml-1">🧊</span>
                </label>

                    </div>
                  ))
                  : <div className="text-xs text-gray-400">Kein Menü für diesen Tag.</div>
                }
              </div>
            </div>
          );
        })}
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

