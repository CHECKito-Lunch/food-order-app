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

interface WeekMenuGrouped {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day = parseInt(req.query.day as string, 10); // 1=Montag …

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

  const menuIds = menus.map(m => m.id);

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id')
    .in('week_menu_id', menuIds);

  if (orderError || !orders) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen' });
  }

  // Gruppieren
  const grouped: Record<string, { title: string; names: string[] }> = {};
  for (const menu of menus) {
    for (const location of ['Nordpol', 'Südpol']) {
      const key = `${menu.id}_${location}`;
      grouped[key] = {
        title: `Menü ${menu.menu_number} – ${location}`,
        names: []
      };
    }
  }

  for (const order of orders) {
    const menu = menus.find(m => m.id === order.week_menu_id);
    if (!menu) continue;
    const key = `${menu.id}_${order.location}`;
    grouped[key]?.names.push(`${order.first_name} ${order.last_name}`);
  }

  // PDF ZIP Export
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Menue_KW${isoWeek}_${isoYear}_Tag${day}.zip`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  let nordpolCount = 1;
  let suedpolCount = 1;

  for (const [key, { title, names }] of Object.entries(grouped)) {
    if (names.length === 0) continue;

    const isNordpol = title.includes('Nordpol');
    const menuNr = isNordpol ? nordpolCount++ : suedpolCount++;
    const filename = `Menü ${menuNr} – ${isNordpol ? 'Nordpol' : 'Südpol'}.pdf`;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 40, right: 40 }
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    // Logos
    const topLogo = path.resolve('./public/checkito-lunch-badge.png');
    const bottomLogo = path.resolve('./public/check24-logo.svg');

    // Logo oben links
    doc.image(topLogo, 40, 30, { width: 100 });

    // Titel zentriert
    doc.fontSize(24).font('Helvetica-Bold').text(title, 0, 100, { align: 'center' });

    // Abstand vor Namen
    doc.moveDown(3);

    // Namen
    doc.fontSize(14).font('Helvetica');
    names.forEach(name => {
      doc.text(name, { align: 'center' });
    });

    // Footer-Logo
    SVGtoPDF(doc, fs.readFileSync(bottomLogo, 'utf8'), doc.page.width - 140, doc.page.height - 70, { width: 100 });

    doc.end();

    await new Promise<void>((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        archive.append(buffer, { name: filename });
        resolve();
      });
    });
  }

  archive.finalize();
}
