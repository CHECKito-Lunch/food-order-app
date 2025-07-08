import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import dayjs from 'dayjs';

type Menu = {
  id?: number;
  day_of_week: number;
  menu_number: number;
  description: string;
  caterer_id: number;
  order_deadline: string;
};

export default function WeekMenuEditor({ isoYear, isoWeek }: { isoYear: number; isoWeek: number }) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [caterers, setCaterers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    supabase.from('caterers').select('*').then(r => r.data && setCaterers(r.data));
    supabase
      .from('week_menus')
      .select('*')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek)
      .then(r => r.data && setMenus(r.data as Menu[]));
  }, [isoYear, isoWeek]);

  const handleAdd = () => {
    setMenus([...menus, {
      day_of_week: 1,
      menu_number: 0,
      description: '',
      caterer_id: caterers[0]?.id || 0,
      order_deadline: dayjs().add(1,'day').format('YYYY-MM-DDTHH:mm')
    }]);
  };

  const handleSave = async () => {
    await supabase.from('week_menus').upsert(
      menus.map(m => ({ ...m, iso_year: isoYear, iso_week: isoWeek }))
    );
    alert('Woche gespeichert');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl">Menü KW {isoWeek}/{isoYear}</h2>
      <button onClick={handleAdd} className="px-3 py-1 bg-blue-500 text-white">+ Menü hinzufügen</button>
      {menus.map((m, i) => (
        <div key={i} className="flex gap-2 items-end">
          <label>Tag:
            <select
              value={m.day_of_week}
              onChange={e => {
                const v = Number(e.target.value);
                setMenus(menus.map((x, idx) => idx === i ? { ...x, day_of_week: v } : x));
              }}
              className="border p-1"
            >
              {[1,2,3,4,5].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>Nr.:
            <input type="number" value={m.menu_number}
                   onChange={e => {
                     const v = Number(e.target.value);
                     setMenus(menus.map((x, idx) => idx === i ? { ...x, menu_number: v } : x));
                   }}
                   className="border p-1 w-16" />
          </label>
          <input type="text" placeholder="Bezeichnung" value={m.description}
                 onChange={e => {
                   const v = e.target.value;
                   setMenus(menus.map((x, idx) => idx === i ? { ...x, description: v } : x));
                 }}
                 className="border p-1 flex-1" />
          <select value={m.caterer_id}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setMenus(menus.map((x, idx) => idx === i ? { ...x, caterer_id: v } : x));
                  }}
                  className="border p-1">
            {caterers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="datetime-local" value={m.order_deadline}
                 onChange={e => {
                   const v = e.target.value;
                   setMenus(menus.map((x, idx) => idx === i ? { ...x, order_deadline: v } : x));
                 }}
                 className="border p-1" />
        </div>
      ))}
      <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white">Speichern</button>
    </div>
  );
}
