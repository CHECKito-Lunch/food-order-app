import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface WeekMenu {
  menu_number: number;
  description: string;
  day_of_week: number;
  iso_week: number;
  iso_year: number;
}

interface Order {
  first_name: string;
  last_name: string;
  location: 'Nordpol' | 'Südpol';
  week_menu_id: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day = parseInt(req.query.day as string, 10); // 1 = Montag

  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  const { data: menus } = await supabase
    .from('week_menus')
    .select('menu_number, description, day_of_week, iso_week, iso_year')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  const { data: orders } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id');

  if (!menus || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=PDF_Export_KW${isoWeek}_${isoYear}_Tag${day}.zip`
  );
  archive.pipe(res);

  const topLogo = path.resolve('./public/checkito-lunch-badge.png');
  const bottomLogo = path.resolve('./public/check24-logo.svg');

  const grouped: Record<string, { menu: WeekMenu; names: string[] }> = {};

  for (const menu of menus) {
    for (const location of ['Nordpol', 'Südpol']) {
      grouped[`${menu.menu_number}_${location}`] = {
        menu,
        names: orders
          .filter(o => o.week_menu_id === menu.menu_number && o.location === location)
          .map(o => `${o.first_name} ${o.last_name}`)
      };
    }
  }

  const byLocation: Record<'Nordpol' | 'Südpol', string[]> = {
    Nordpol: [],
    Südpol: []
  };

  for (const key of Object.keys(grouped)) {
    const [, location] = key.split('_');
    const entry = grouped[key];
    if (entry.names.length > 0) {
      byLocation[location as 'Nordpol' | 'Südpol'].push(key);
    }
  }

  for (const location of ['Nordpol', 'Südpol'] as const) {
    const keys = byLocation[location];

    for (let i = 0; i < keys.length; i += 2) {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks: Uint8Array[] = [];
      doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

      const drawMenu = (
        xOffset: number,
        entry: { menu: WeekMenu; names: string[] },
        menuNr: number
      ) => {
        // Logo links oben
        doc.image(topLogo, xOffset + 20, 20, { width: 60 });

        // Titel
        doc.font('Helvetica-Bold')
          .fontSize(18)
          .text(`Menü ${menuNr} – ${location}`, xOffset, 120, {
            width: 297,
            align: 'center'
          });

        // Sterntrenner
        doc.font('Helvetica-Bold').fontSize(14).text('★ ★ ★', xOffset, 150, {
          width: 297,
          align: 'center'
        });

        // Namen
        doc.font('Helvetica').fontSize(10);
        let y = 180;
        for (const name of entry.names) {
          doc.text(name, xOffset, y, { width: 297, align: 'center' });
          y += 14;
        }

        // CHECK24 Logo unten rechts
        SVGtoPDF(doc, fs.readFileSync(bottomLogo, 'utf-8'), xOffset + 297 - 100, 520, {
          width: 80
        });
      };

      const entryLeft = grouped[keys[i]];
      const entryRight = grouped[keys[i + 1]];

      drawMenu(30, entryLeft, i + 1);

      if (entryRight) {
        drawMenu(325, entryRight, i + 2);
      }

      doc.end();
      await new Promise<void>(resolve => {
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          archive.append(buffer, {
            name: `Menü ${i + 1} – ${location}.pdf`
          });
          resolve();
        });
      });
    }
  }

  archive.finalize();
}
