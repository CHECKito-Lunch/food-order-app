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

// Typisierung für Menü
interface WeekMenuGrouped {
  menu_number: number;
  description: string;
  day_of_week: number;
  iso_week: number;
  iso_year: number;
}

// Typisierung für Besteller
interface Order {
  first_name: string;
  last_name: string;
  location: 'Nordpol' | 'Südpol';
  week_menu_id: number;
}

// Helper zum Gruppieren der Bestellungen
function groupOrdersByLocationAndMenu(
  orders: Order[],
  menus: WeekMenuGrouped[]
): Record<string, { title: string; names: string[] }> {
  const grouped: Record<string, { title: string; names: string[] }> = {};

  for (const menu of menus) {
    for (const location of ['Nordpol', 'Südpol']) {
      const key = `${menu.menu_number}_${location}`;
      grouped[key] = {
        title: `Menü ${menu.menu_number} – ${location}`,
        names: []
      };
    }
  }

  for (const order of orders) {
    const menu = menus.find((m) => m.menu_number === order.week_menu_id);
    if (!menu) continue;
    const key = `${menu.menu_number}_${order.location}`;
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
  const day = parseInt(req.query.day as string, 10); // 1 = Montag, …

  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  // Menüdaten holen
  const { data: menus, error: menuError } = await supabase
    .from('week_menus')
    .select('menu_number, description, day_of_week, iso_week, iso_year')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  if (menuError || !menus) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Menüs' });
  }

  // Bestellungen holen
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id');

  if (orderError || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen' });
  }

  const grouped = groupOrdersByLocationAndMenu(orders, menus as WeekMenuGrouped[]);

  // Zip-Datei erstellen
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Menue_Export_KW${isoWeek}_${isoYear}_Tag${day}.zip`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  let nordpolCount = 1;
  let suedpolCount = 1;

  for (const [key, { title, names }] of Object.entries(grouped)) {
    if (names.length === 0) continue;

    const isNordpol = title.includes('Nordpol');
    const menuNr = isNordpol ? nordpolCount++ : suedpolCount++;
    const dateiname = `Menü ${menuNr} - ${isNordpol ? 'Nordpol' : 'Südpol'}.pdf`;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 30, right: 30 }
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    // Add logos
    const topLogo = path.resolve('./public/checkito-lunch-badge.png');
    const bottomLogo = path.resolve('./public/check24-logo.svg');

    // Erste Seite (links)
    doc.fontSize(20).font('Helvetica-Bold').text(title, 60, 60, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    names.forEach((name) => doc.text(name, { align: 'center' }));

    // Add bottom logo (rechte untere Ecke)
    SVGtoPDF(doc, fs.readFileSync(bottomLogo, 'utf-8'), 720, 500, { width: 100 });

    // Zweite Seite wäre hier optional → wir bleiben bei 1x A5 je Seite im Querformat

    doc.end();

    await new Promise<void>((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        archive.append(buffer, { name: dateiname });
        resolve();
      });
    });
  }

  archive.finalize();
}
