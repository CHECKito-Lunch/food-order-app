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
  id: number;
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

function groupOrders(orders: Order[], menus: WeekMenu[]) {
  const grouped: Record<string, { menu: WeekMenu; names: string[] }> = {};

  for (const menu of menus) {
    for (const location of ['Nordpol', 'Südpol']) {
      const key = `${location}_${menu.id}`;
      grouped[key] = { menu, names: [] };
    }
  }

  for (const order of orders) {
    const menu = menus.find(m => m.id === order.week_menu_id);
    if (!menu) continue;
    const key = `${order.location}_${menu.id}`;
    if (grouped[key]) {
      grouped[key].names.push(`${order.first_name} ${order.last_name}`);
    }
  }

  return grouped;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day = parseInt(req.query.day as string, 10);

  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  const { data: menus } = await supabase
    .from('week_menus')
    .select('id, menu_number, description, day_of_week, iso_week, iso_year')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  const { data: orders } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id');

  if (!menus || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
  }

  const grouped = groupOrders(orders, menus as WeekMenu[]);
  const locations: ('Nordpol' | 'Südpol')[] = ['Nordpol', 'Südpol'];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Menue_Export_KW${isoWeek}_${isoYear}_Tag${day}.zip`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  const badgePath = path.resolve('./public/checkito-lunch-badge.png');
  const logoPath = path.resolve('./public/check24-logo.svg');

  for (const location of locations) {
    const locationMenus = Object.entries(grouped)
      .filter(([key]) => key.startsWith(location))
      .filter(([, value]) => value.names.length > 0);

    if (locationMenus.length === 0) continue;

    let menuNr = 1;

    for (let i = 0; i < locationMenus.length; i += 2) {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks: Uint8Array[] = [];
      doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

      const drawBlock = (
        x: number,
        menu: WeekMenu,
        names: string[],
        nr: number
      ) => {
        doc.rect(x, 0, 420, 595).fill('#ffffff');

        doc.image(badgePath, x + 20, 20, { width: 80 });

        doc.fillColor('black').font('Helvetica-Bold').fontSize(16)
          .text(`Menü ${nr} – ${location}`, x + 60, 120, {
            width: 300,
            align: 'center'
          });

      

        doc.font('Helvetica').fontSize(12);
        let y = 190;
        for (const name of names) {
          doc.text(name, x + 60, y, { width: 300, align: 'center' });
          y += 18;
        }

        SVGtoPDF(doc, fs.readFileSync(logoPath, 'utf-8'), x + 310, 520, { width: 90 });
      };

      const first = locationMenus[i];
      const second = locationMenus[i + 1];

      drawBlock(0, first[1].menu, first[1].names, menuNr++);

      if (second) {
        drawBlock(420, second[1].menu, second[1].names, menuNr++);
      }

      doc.end();

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const filename = `Menü ${menuNr - (second ? 2 : 1)} – ${location}.pdf`;
      archive.append(buffer, { name: filename });
    }
  }

  archive.finalize();
}
