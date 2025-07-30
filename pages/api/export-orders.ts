import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import svgToPdf from 'svg-to-pdfkit';
import archiver from 'archiver';
import stream from 'stream';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEEKDAYS: Record<number, string> = {
  1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const week = Number(req.query.week);
  const year = Number(req.query.year);

  if (!week || !year) {
    return res.status(400).send("Fehlende Parameter: week & year");
  }

  // Daten abrufen
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, first_name, last_name, location,
      week_menus (
        menu_number, description, caterer_id,
        day_of_week, iso_week, iso_year
      )
    `)
    .eq('week_menus.iso_week', week)
    .eq('week_menus.iso_year', year);

  if (error || !data) {
    console.error(error);
    return res.status(500).json({ error: "Supabase Fehler" });
  }

  // Gruppieren nach Menübeschreibung & Standort
  const grouped: Record<string, { location: string; names: string[] }[]> = {};
  for (const row of data) {
    const menu = row.week_menus;
    if (!menu) continue;

    const key = `${WEEKDAYS[menu.day_of_week]} - ${menu.description}`;
    const person = `${row.first_name} ${row.last_name}`;
    const groupList = grouped[key] ?? [];

    const existing = groupList.find(g => g.location === row.location);
    if (existing) {
      existing.names.push(person);
    } else {
      groupList.push({ location: row.location, names: [person] });
    }
    grouped[key] = groupList;
  }

  // PDF-Assets vorbereiten
  const badgePath = path.resolve('./public/checkito-lunch-badge.png');
  const check24Path = path.resolve('./public/check24-logo.svg');
  const check24SVG = fs.readFileSync(check24Path, 'utf-8');

  // ZIP-Stream vorbereiten
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=Export_KW${week}_${year}.zip`);
  const archive = archiver('zip');
  archive.pipe(res);

  // Menü-PDFs generieren
  const items: { title: string; location: string; names: string[] }[] = [];

  for (const [key, locGroups] of Object.entries(grouped)) {
    for (const g of locGroups) {
      items.push({ title: key, location: g.location, names: g.names });
    }
  }

  const chunkSize = 2;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const doc = new PDFDocument({ layout: 'landscape', margin: 0 });
    const pass = new stream.PassThrough();

    chunk.forEach((item, index) => {
      const xOffset = index === 0 ? 0 : doc.page.width / 2;
      const marginX = xOffset + 20;
      const marginY = 30;

      doc.image(badgePath, marginX, marginY, { width: 50 });

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#003893');
      doc.text(item.title, marginX + 60, marginY + 10, { align: 'left', width: 200 });

      doc.font('Helvetica').fontSize(14).fillColor('black');
      doc.text('***', marginX + 60, marginY + 30, { align: 'left' });

      doc.fontSize(12);
      let offset = 0;
      item.names.forEach(name => {
        doc.text(name, marginX + 60, marginY + 50 + offset, { align: 'left' });
        offset += 16;
      });
    });

    // CHECK24 Logo im Footer
    svgToPdf(doc, check24SVG, doc.page.width - 80, doc.page.height - 40, { width: 60 });

    doc.end();
    doc.pipe(pass);

    const name = `Menüs_${i / 2 + 1}.pdf`;
    archive.append(pass, { name });
  }

  await archive.finalize();
}
