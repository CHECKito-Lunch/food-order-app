import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import dayjs from 'dayjs';

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

  // --- Menü-Laden ausgelagert ---
  const reloadMenus = async () => {
    const { data: loaded } = await supabase
      .from('week_menus')
      .select('*')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek);

    const grouped: MenuPerDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (loaded || []).forEach((m: any) => {
      grouped[m.day_of_week].push(m);
    });
    setMenus(grouped);
    setUndoStack([]);
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
          order_deadline: dayjs().add(d - dayjs().day() + 1, "day").format('YYYY-MM-DDTHH:mm')
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
        order_deadline: dayjs().add(pasteTarget - dayjs().day() + 1, "day").format('YYYY-MM-DDTHH:mm')
      }))
    }));
    setCopiedDay(null);
  };

  // Speichern/Upsert (auf id! - siehe dein Tabellenschema)
  const handleSave = async () => {
    const allMenus = Object.entries(menus).flatMap(([d, arr]) =>
      arr.map(m => ({
        ...m,
        day_of_week: Number(d),
        iso_year: isoYear,
        iso_week: isoWeek,
      }))
    );

    // Upsert auf id (Auto-Increment Primary Key)
    // Wenn id fehlt, wird INSERT gemacht, sonst UPDATE!
    const { error } = await supabase
      .from('week_menus')
      .upsert(allMenus, { onConflict: 'id' });
    if (error) {
      alert('Fehler beim Speichern: ' + error.message);
      return;
    }
    alert('Woche gespeichert');
    // Nach Speichern Menüs neu laden
    reloadMenus();
  };

  // Preset speichern
  const handleSavePreset = async () => {
    if (!presetName) return alert("Bitte Preset-Namen eingeben!");
    const presetData = { name: presetName, menus: JSON.stringify(menus) };
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

  // Preset laden (mit Bestätigung!)
  const handleTryLoadPreset = () => {
    if (!selectedPresetId) return;
    setConfirm({ action: "load-preset", payload: selectedPresetId });
  };
  const handleLoadPreset = () => {
    if (!selectedPresetId) return;
    const preset = presets.find(p => p.id === selectedPresetId);
    if (preset) {
      pushUndo();
      setMenus(JSON.parse(JSON.stringify(preset.menus)));
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
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-30 flex items-center justify-center z-30">
        <div className="bg-white p-8 rounded-lg shadow-lg min-w-[300px] text-center">
          {confirm.action === "delete-preset" && (
            <>
              <p className="mb-4">Preset wirklich <b>löschen</b>?</p>
              <button className="bg-red-600 text-white px-4 py-2 rounded mr-2" onClick={handleDeletePreset}>Löschen</button>
              <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setConfirm(null)}>Abbrechen</button>
            </>
          )}
          {confirm.action === "load-preset" && (
            <>
              <p className="mb-4">Preset wirklich <b>laden</b>?<br /><span className="text-sm text-gray-500">(Alle aktuellen Menüs werden überschrieben!)</span></p>
              <button className="bg-green-600 text-white px-4 py-2 rounded mr-2" onClick={handleLoadPreset}>Preset laden</button>
              <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setConfirm(null)}>Abbrechen</button>
            </>
          )}
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold mb-2">Menü KW {isoWeek}/{isoYear}</h2>
      <div className="flex gap-2 mb-2 flex-wrap">
        <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset-Name" className="border p-1"/>
        <button onClick={handleSavePreset} className="bg-blue-600 text-white px-3 py-1 rounded">Preset speichern</button>
        <select value={selectedPresetId || ""} onChange={e => setSelectedPresetId(Number(e.target.value))} className="border p-1">
          <option value="">Preset wählen…</option>
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={handleTryLoadPreset} className="bg-green-600 text-white px-3 py-1 rounded">Preset laden</button>
        <button onClick={handleUndo} disabled={undoStack.length === 0} className="bg-yellow-400 text-black px-3 py-1 rounded ml-4 disabled:bg-yellow-200">Undo</button>
        <button onClick={exportCSV} className="bg-orange-600 text-white px-3 py-1 rounded ml-2">Export als CSV</button>
      </div>
      {/* Preset-Liste für Edit/Löschen */}
      <div className="mb-2">
        {presets.map(p => (
          <div key={p.id} className="flex items-center gap-2 text-sm mt-1">
            {editPresetId === p.id ? (
              <>
                <input value={editPresetName} onChange={e => setEditPresetName(e.target.value)} className="border p-1"/>
                <button onClick={handleSavePresetName} className="bg-blue-600 text-white px-2 py-1 rounded">Speichern</button>
                <button onClick={() => setEditPresetId(null)} className="text-red-600">Abbrechen</button>
              </>
            ) : (
              <>
                <span>{p.name}</span>
                <button onClick={() => handleEditPresetName(p.id, p.name)} className="text-blue-600 underline">Umbenennen</button>
                <button onClick={() => handleTryDeletePreset(p.id)} className="text-red-600 underline">Löschen</button>
              </>
            )}
          </div>
        ))}
      </div>
      {Object.entries(WEEKDAYS).map(([d, name]) => (
        <div key={d} className="mb-4 border rounded p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{name}</div>
            <div>
              <button onClick={() => handleAddMenu(Number(d))} className="px-2 bg-blue-500 text-white rounded mr-2">+ Menü</button>
              <button onClick={() => handleCopyDay(Number(d))} className="px-2 bg-yellow-400 text-black rounded mr-2">Kopieren</button>
              {copiedDay && (
                <>
                  <select
                    value={pasteTarget}
                    onChange={e => setPasteTarget(Number(e.target.value))}
                    className="border p-1 mx-2"
                  >
                    {[1,2,3,4,5].map(dd => <option key={dd} value={dd}>{WEEKDAYS[dd]}</option>)}
                  </select>
                  <button onClick={handlePasteDay} className="bg-green-600 text-white rounded px-2">Einfügen</button>
                  <button onClick={() => setCopiedDay(null)} className="text-red-600 ml-2">Abbruch</button>
                </>
              )}
            </div>
          </div>
          {menus[Number(d)].length === 0 && (
            <div className="text-gray-500 text-sm">Noch kein Menü für {name}.</div>
          )}
          {menus[Number(d)].map((m, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="number" value={m.menu_number}
                onChange={e => handleMenuChange(Number(d), i, { menu_number: Number(e.target.value) })}
                className="border p-1 w-16" />
              <input type="text" value={m.description}
                onChange={e => handleMenuChange(Number(d), i, { description: e.target.value })}
                className="border p-1 w-48" placeholder="Bezeichnung" />
              <select value={m.caterer_id}
                onChange={e => handleMenuChange(Number(d), i, { caterer_id: Number(e.target.value) })}
                className="border p-1">
                {CATERER_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="datetime-local" value={m.order_deadline}
                onChange={e => handleMenuChange(Number(d), i, { order_deadline: e.target.value })}
                className="border p-1" />
              <button onClick={() => handleRemoveMenu(Number(d), i)} className="bg-red-500 text-white rounded px-2">Entfernen</button>
            </div>
          ))}
        </div>
      ))}
      <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">Speichern</button>
      <ConfirmModal />
    </div>
  );
}
