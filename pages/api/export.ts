import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import { Parser } from 'papaparse';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { iso_year, iso_week } = req.query;
  if (!iso_year || !iso_week) {
    return res.status(400).send('iso_year und iso_week erforderlich');
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      profiles(first_name,last_name),
      week_menus(menu_number,description,iso_week,caterer(name))
    `)
    .eq('week_menus.iso_year', Number(iso_year))
    .eq('week_menus.iso_week', Number(iso_week));

  if (error) return res.status(500).send(error.message);

  const rows = (data || []).map(r => ({
    Vorname: r.profiles.first_name,
    Name:    r.profiles.last_name,
    MenüNr:  r.week_menus.menu_number,
    Bezeichnung: r.week_menus.description,
    Caterer: r.week_menus.caterer.name,
    Kalenderwoche: r.week_menus.iso_week
  }));

  const csv = new Parser().parse(rows).csv;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orders_W${iso_week}_Y${iso_year}.csv"`
  );
  res.send(csv);
}
