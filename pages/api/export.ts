// pages/api/export.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import { unparse } from 'papaparse';

interface RawOrder {
  profiles: { first_name: string; last_name: string }[];
  week_menus: {
    menu_number: number;
    description: string;
    iso_week: number;
    caterer: { name: string }[];
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { iso_year, iso_week } = req.query;
  if (!iso_year || !iso_week) {
    return res.status(400).send('iso_year und iso_week erforderlich');
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      profiles(first_name, last_name),
      week_menus(
        menu_number,
        description,
        iso_week,
        caterer(name)
      )
    `)
    .eq('week_menus.iso_year', Number(iso_year))
    .eq('week_menus.iso_week', Number(iso_week));

  if (error) {
    return res.status(500).send(error.message);
  }

  // Rohe Daten in unser Interface casten
  const raw = (data ?? []) as RawOrder[];
  const rows = raw.map(r => {
    const profile = r.profiles[0] ?? { first_name: '', last_name: '' };
    const wm = r.week_menus[0] ?? {
      menu_number: 0,
      description: '',
      iso_week: 0,
      caterer: [],
    };
    return {
      Vorname:       profile.first_name,
      Name:          profile.last_name,
      MenüNr:        wm.menu_number,
      Bezeichnung:   wm.description,
      Caterer:       wm.caterer[0]?.name ?? '',
      Kalenderwoche: wm.iso_week,
    };
  });

  // CSV erzeugen
  const csv = unparse(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orders_W${iso_week}_Y${iso_year}.csv"`
  );
  res.status(200).send(csv);
}
