import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import dayjs from 'dayjs';

const CATERER_OPTIONS = [
  { id: 1, name: 'Dean&David' },
  { id: 2, name: 'Merkel' },
  { id: 3, name: 'Bloi' },
];

// Die Lösung: Explizite number-Index-Signatur!
const WEEKDAYS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag'
};

type Menu = {
  id?: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  caterer_id: number;
  order_deadline: string;
};

type Preset = {
  id: number;
  name: string;
  menus: Menu[];
};

export default function WeekMenuEditor({ isoYear, isoWeek }: { isoYear: number; isoWeek: number }) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [undoStack, setUndoStack] = useState<Menu[][]>([]);
  const [copiedDay, setCopiedDay] = useState<number | null>(null);
  const [pasteTarget, setPasteTarget] = useState<number>(1);

  // Preset States
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [editPresetId, setEditPresetId] = useState<number | null>(null);
  const [editPresetName, setEditPresetName] = useState('');
  const [confirm, setConfirm] = useState<{ action: string, payload?: any } | null>(null);

  // Load menus & presets
  useEffect(() => {
    supabase
      .from('week_menus')
      .select('*')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek)
      .then(r => {
        const loaded = (r.data as Menu[]) || [];
        const fullMenus: Menu[] = [];
        for (let day = 1; day <= 5; day++) {
          const found = loaded.filter(m => m.day_of_week === day);
          if (found.length) {
            fullMenus.push(...found);
          } else {
            fullMenus.push({
              day_of_week: day,
              menu_number: 1,
              description: '',
              caterer_id: CATERER_OPTIONS[0].id,
              order_deadline: dayjs().add(day - dayjs().day() + 1, "day").format('YYYY-MM-DDTHH:mm')
            });
          }
        }
        setMenus(fullMenus);
        setUndoStack([]); // reset Undo bei neuem Laden
      });
    supabase.from('week_menu_presets').select('*').then(r => {
      setPresets(r.data || []);
    });
  }, [isoYear, isoWeek]);

  // --- Undo-Mechanik ---
  function pushUndo() {
    setUndoStack(s => [...s.slice(-9), menus.map(m => ({ ...m }))]); // nur max 10
  }
  function handleUndo() {
    if (undoStack.length === 0) return;
    setMenus(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  }

  // --- Menü bearbeiten ---
  const handleChange = (idx: number, changes: Partial<Menu>) => {
    pushUndo();
    setMenus(menus.map((m, i) => i === idx ? { ...m, ...changes } : m));
  };

  // --- Menü hinzufügen/entfernen ---
  const handleAdd = () => {
    pushUndo();
    const nextEmpty = [1,2,3,4,5].find(d => !menus.some(m => m.day_of_week === d && m.description));
    setMenus([
      ...menus,
      {
        day_of_week: nextEmpty || 1,
        menu_number: 1,
        description: '',
        caterer_id: CATERER_OPTIONS[0].id,
        order_deadline: dayjs().add((nextEmpty || 1) - dayjs().day() + 1, "day").format('YYYY-MM-DDTHH:mm')
      }
    ]);
  };
  const handleRemove = (idx: number) => {
    pushUndo();
    setMenus(menus.filter((_, i) => i !== idx));
  };

  // --- Speichern ---
  const handleSave = async () => {
    await supabase.from('week_menus').upsert(
      menus.map(m => ({ ...m, iso_year: isoYear, iso_week: isoWeek }))
    );
    alert('Woche gespeichert');
  };

  // --- Preset speichern ---
  const handleSavePreset = async () => {
    if (!presetName) return alert("Bitte Preset-Namen eingeben!");
    const { error } = await supabase.from('week_menu_presets').insert({
      name: presetName,
      menus: menus.map(m => ({ ...m, id: undefined }))
    });
    if (!error) {
      setPresetName('');
      alert("Preset gespeichert!");
      const { data } = await supabase.from('week_menu_presets').select('*');
      setPresets(data || []);
    }
  };

  // --- Preset laden (mit Bestätigung!) ---
  const handleTryLoadPreset = () => {
    if (!selectedPresetId) return;
    setConfirm({ action: "load-preset", payload: selectedPresetId });
  };
  const handleLoadPreset = () => {
    if (!selectedPresetId) return;
    const preset = presets.find(p => p.id === selectedPresetId);
    if (preset) {
      pushUndo();
      setMenus(preset.menus.map(m => ({
        ...m,
        id: undefined,
        order_deadline: dayjs().add(m.day_of_week - dayjs().day() + 1, "day").format('YYYY-MM-DDTHH:mm')
      })));
    }
    setConfirm(null);
  };

  // --- Preset umbenennen ---
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
    setPresets(data || []);
  };

  // --- Preset löschen (mit Bestätigung) ---
  const handleTryDeletePreset = (id: number) => setConfirm({ action: "delete-preset", payload: id });
  const handleDeletePreset = async () => {
    if (!confirm?.payload) return;
    await supabase.from('week_menu_presets').delete().eq('id', confirm.payload);
    setConfirm(null);
    const { data } = await supabase.from('week_menu_presets').select('*');
    setPresets(data || []);
  };

  // --- Copy/Paste für Tage ---
  const handleCopyDay = (day: number) => {
    setCopiedDay(day);
    setPasteTarget(day);
  };
  const handlePasteDay = () => {
    if (!copiedDay) return;
    pushUndo();
    const copiedMenus = menus.filter(m => m.day_of_week === copiedDay);
    let nextMenus = menus.filter(m => m.day_of_week !== pasteTarget);
    const todayBase = dayjs().add(pasteTarget - dayjs().day() + 1, "day");
    const pastedMenus = copiedMenus.map(m => ({
      ...m,
      id: undefined,
      day_of_week: pasteTarget,
      order_deadline: todayBase.format('YYYY-MM-DDTHH:mm')
    }));
    setMenus([...nextMenus, ...pastedMenus]);
    setCopiedDay(null);
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
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-2">Menü KW {isoWeek}/{isoYear}</h2>
      
      {/* Presets */}
      <div className="flex gap-2 mb-2 flex-wrap">
        <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset-Name" className="border p-1"/>
        <button onClick={handleSavePreset} className="bg-blue-600 text-white px-3 py-1 rounded">Preset speichern</button>
        <select value={selectedPresetId || ""} onChange={e => setSelectedPresetId(Number(e.target.value))} className="border p-1">
          <option value="">Preset wählen…</option>
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={handleTryLoadPreset} className="bg-green-600 text-white px-3 py-1 rounded">Preset laden</button>
        <button onClick={handleUndo} disabled={undoStack.length === 0} className="bg-yellow-400 text-black px-3 py-1 rounded ml-4 disabled:bg-yellow-200">Undo</button>
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
      
      {/* Copy/Paste UI */}
      {copiedDay && (
        <div className="p-2 bg-yellow-100 rounded flex items-center gap-4">
          <span>Tag <b>{WEEKDAYS[copiedDay] || ''}</b> kopiert.</span>
          <span>Einfügen bei:
            <select
              value={pasteTarget}
              onChange={e => setPasteTarget(Number(e.target.value))}
              className="mx-2 border p-1"
            >
              {[1, 2, 3, 4, 5].map(d => (
                <option key={d} value={d}>{WEEKDAYS[d]}</option>
              ))}
            </select>
            <button
              onClick={handlePasteDay}
              className="bg-green-600 text-white rounded px-3 py-1 mx-2"
            >Einfügen</button>
            <button onClick={() => setCopiedDay(null)} className="text-red-600 underline">Abbrechen</button>
          </span>
        </div>
      )}

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Tag</th>
            <th className="p-2 border">Nr.</th>
            <th className="p-2 border">Bezeichnung</th>
            <th className="p-2 border">Caterer</th>
            <th className="p-2 border">Deadline</th>
            <th className="p-2 border"></th>
          </tr>
        </thead>
        <tbody>
          {menus.map((m, i) => (
            <tr key={i}>
              <td className="border p-1 flex items-center gap-1">
                <select
                  value={m.day_of_week}
                  onChange={e => handleChange(i, { day_of_week: Number(e.target.value) })}
                  className="border p-1"
                >
                  {[1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>{WEEKDAYS[d]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ml-2 px-2 text-sm bg-gray-200 rounded"
                  onClick={() => handleCopyDay(m.day_of_week)}
                  title="Tag kopieren"
                >
                  Kopieren
                </button>
              </td>
              <td className="border p-1">
                <input
                  type="number"
                  value={m.menu_number}
                  onChange={e => handleChange(i, { menu_number: Number(e.target.value) })}
                  className="border p-1 w-16"
                />
              </td>
              <td className="border p-1">
                <input
                  type="text"
                  placeholder="Bezeichnung"
                  value={m.description}
                  onChange={e => handleChange(i, { description: e.target.value })}
                  className="border p-1 w-40"
                />
              </td>
              <td className="border p-1">
                <select
                  value={m.caterer_id}
                  onChange={e => handleChange(i, { caterer_id: Number(e.target.value) })}
                  className="border p-1"
                >
                  {CATERER_OPTIONS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td className="border p-1">
                <input
                  type="datetime-local"
                  value={m.order_deadline}
                  onChange={e => handleChange(i, { order_deadline: e.target.value })}
                  className="border p-1"
                />
              </td>
              <td className="border p-1">
                <button
                  onClick={() => handleRemove(i)}
                  className="bg-red-500 text-white rounded px-2 py-1"
                  title="Entfernen"
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">Speichern</button>
      <ConfirmModal />
    </div>
  );
}
