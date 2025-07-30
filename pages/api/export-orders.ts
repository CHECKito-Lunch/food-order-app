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

// Gruppieren der Menüs mit Bestellern
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

// API-Handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day = parseInt(req.query.day as string, 10);

  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  const { data: menus, error: menuError } = await supabase
    .from('week_menus')
    .select('id, menu_number, description, day_of_week, iso_week, iso_year')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  if (menuError || !menus) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Menüs' });
  }

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id');

  if (orderError || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen' });
  }

  const grouped = groupOrders(orders, menus as WeekMenu[]);

  // Sortiere nach Standort
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

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    let menuCount = 1;

    for (let i = 0; i < locationMenus.length; i += 2) {
      const pair = locationMenus.slice(i, i + 2);

      for (let j = 0; j < pair.length; j++) {
        const { menu, names } = pair[j][1];

        const offsetX = j === 0 ? 0 : 420; // 0 für links, 420 für rechts
        const centerX = offsetX + 210;

        // Hintergrund
        doc.rect(offsetX, 0, 420, 595).fill('#ffffff');

        // Badge
        doc.image(badgePath, offsetX + 20, 20, { width: 80 });

        // Titel
        doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text(
          `Menü ${menuCount} – ${location}`,
          centerX,
          120,
          { align: 'center' }
        );

        // Separator
        doc.fontSize(18).text('✶✶✶', centerX, 150, { align: 'center' });

        // Namen
        doc.fontSize(12).font('Helvetica').fillColor('black');
        let startY = 190;
        names.forEach((name) => {
          doc.text(name, offsetX + 40, startY, { width: 340, align: 'center' });
          startY += 18;
        });

        // CHECK24 Logo unten rechts
        SVGtoPDF(doc, fs.readFileSync(logoPath, 'utf-8'), offsetX + 300, 500, { width: 100 });

        menuCount++;
      }

      // Neue Seite, wenn noch mehr folgen
      if (i + 2 < locationMenus.length) {
        doc.addPage();
      }
    }

    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    archive.append(buffer, { name: `${location}.pdf` });
  }

  archive.finalize();
}
