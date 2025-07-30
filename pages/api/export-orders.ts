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
   in_fridge: boolean;   
}

interface Order {
  first_name: string;
  last_name: string;
  location: 'Nordpol' | 'Südpol';
  week_menu_id: number;
}

// Gruppiert pro Menü und Standort
function groupOrders(orders: Order[], menus: WeekMenu[]) {
  const grouped: Record<string, { menu: WeekMenu; names: string[] }> = {};
  for (const menu of menus) {
    for (const location of ['Nordpol', 'Südpol'] as const) {
      grouped[`${location}_${menu.id}`] = { menu, names: [] };
    }
  }
  for (const order of orders) {
    const menu = menus.find(m => m.id === order.week_menu_id);
    if (!menu) continue;
    grouped[`${order.location}_${menu.id}`].names.push(
      `${order.first_name} ${order.last_name}`
    );
  }
  return grouped;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day = parseInt(req.query.day as string, 10);
  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  const { data: menus, error: menuError } = await supabase
    .from('week_menus')
    .select('id, menu_number, description, day_of_week, iso_week, iso_year, in_fridge')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id');

  if (menuError || orderError || !menus || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
  }

  const grouped = groupOrders(orders as Order[], menus as WeekMenu[]);
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

  // Zeichnet einen A5-Block bei x
  const drawBlock = (
    doc: PDFKit.PDFDocument,
    x: number,
    entry: { menu: WeekMenu; names: string[] }
  ) => {
    const { menu, names } = entry;
    // Hintergrund
    doc.rect(x, 0, 420, 595).fill('#ffffff');

    // Gesamtzahl fett oben rechts
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('black')
      .text(`${names.length}×`, x + 360, 30, { width: 40, align: 'right' });

    // Badge etwas tiefer
    doc.image(badgePath, x + 20, 20, { width: 80 });

    // Titel etwas tiefer beginnen
    doc
      .fillColor('black')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(
        `Menü ${menu.menu_number} – ${menu.description}`,
        x + 20,
        160,
        { width: 380, align: 'center' }
      );

    // Besteller-Namen
    doc.font('Helvetica').fontSize(12);
    let y = 220;
    for (const name of names) {
      doc.text(name, x + 20, y, { width: 380, align: 'center' });
      y += 18;
    }
 // Falls im Kühlschrank: roten Hinweis ganz unten
    if (menu.in_fridge) {
      doc
        .fillColor('red')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(
          'befindet sich im Kühlschrank',
          x + 20,
          560,
          { width: 380, align: 'center' }
        );
    }
    // CHECK24-Logo unten rechts
    SVGtoPDF(
      doc,
      fs.readFileSync(logoPath, 'utf-8'),
      x + 330,
      500,
      { width: 80 }
    );
  };

  // Pro Standort jeweils 2 A5-Blöcke auf A4 Quer
  for (const location of locations) {
    const keys = Object.keys(grouped)
      .filter(k => k.startsWith(location))
      .filter(k => grouped[k].names.length > 0);

    for (let i = 0; i < keys.length; i += 2) {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
      });
      const chunks: Uint8Array[] = [];
      doc.on('data', chunk => chunks.push(chunk));

      const pair = keys.slice(i, i + 2).map(k => grouped[k]);
      drawBlock(doc, 0, pair[0]);
      if (pair[1]) drawBlock(doc, 420, pair[1]);

      doc.end();

      const buffer = await new Promise<Buffer>(resolve =>
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      );

      // Dateiname mit realer Menünummer und Standort
      const menuNr = pair[0].menu.menu_number;
      archive.append(buffer, {
        name: `Menü ${menuNr} – ${location}.pdf`,
      });
    }
  }

  await archive.finalize();
}
