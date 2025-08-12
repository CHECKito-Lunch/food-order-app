// pages/api/export-orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';

export const config = {
  api: { bodyParser: false },
};

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

// Gruppiert Bestellungen pro Menü & Standort
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Parameter prüfen
  const isoWeek = parseInt(req.query.isoWeek as string, 10);
  const isoYear = parseInt(req.query.isoYear as string, 10);
  const day     = parseInt(req.query.day as string, 10);
  if (isNaN(isoWeek) || isNaN(isoYear) || isNaN(day)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  // 2) Menüs (nur für den gewählten Tag) laden
  const { data: menus, error: menuError } = await supabase
    .from('week_menus')
    .select('id, menu_number, description, day_of_week, iso_week, iso_year, in_fridge')
    .eq('iso_week', isoWeek)
    .eq('iso_year', isoYear)
    .eq('day_of_week', day);

  if (menuError) {
    console.error(menuError);
    return res.status(500).json({ error: 'Fehler beim Abrufen der Menüs' });
  }
  if (!menus || menus.length === 0) {
    // Keine Menüs für diesen Tag => leeres ZIP zurück
    const emptyArchive = archiver('zip', { zlib: { level: 9 } });
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    emptyArchive.pipe(pass);
    pass.on('data', (c: Buffer) => chunks.push(c));
    await emptyArchive.finalize();
    return res
      .status(200)
      .setHeader('Content-Type', 'application/zip')
      .setHeader('Content-Disposition', `attachment; filename=Menue_Export_KW${isoWeek}_${isoYear}_Tag${day}.zip`)
      .send(Buffer.concat(chunks));
  }

  // 2b) Nur Orders für diese Menü-IDs laden (entscheidend!)
  const menuIds = menus.map(m => m.id);
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('first_name, last_name, location, week_menu_id')
    .in('week_menu_id', menuIds) // <-- Filter auf Tages-Menüs
    .order('week_menu_id', { ascending: true });

  if (orderError) {
    console.error(orderError);
    return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen' });
  }

  // 3) ZIP in Buffer sammeln
  const archive = archiver('zip', { zlib: { level: 9 } });
  const pass = new PassThrough();
  const zipChunks: Buffer[] = [];
  archive.on('warning', (err: Error) => console.warn('Archiver warning:', err));
  archive.on('error', (err: Error) => { console.error('Archiver error:', err); throw err; });
  archive.pipe(pass);
  pass.on('data', (chunk: Buffer) => zipChunks.push(chunk));

  // 4) PDFs erzeugen
  const badgePath = path.resolve('./public/checkito-lunch-badge.png');
  const logoPath  = path.resolve('./public/check24-logo.svg');

  function drawBlock(doc: PDFKit.PDFDocument, x: number, entry: { menu: WeekMenu; names: string[] }) {
    const { menu, names } = entry;
    doc.rect(x, 0, 420, 595).fill('#ffffff');

    doc.font('Helvetica-Bold').fontSize(14).fillColor('black')
       .text(`${names.length}×`, x + 360, 20, { width: 40, align: 'right' });

    if (fs.existsSync(badgePath)) doc.image(badgePath, x + 1, 20, { width: 80 });

    doc.font('Helvetica-Bold').fontSize(16).fillColor('black')
       .text(`Menü ${menu.menu_number} – ${menu.description}`, x + 85, 20, {
         width: 270, align: 'center'
       });

    const separatorY = 185;
    doc.save();
    doc.moveTo(x + 20, separatorY)
       .lineTo(x + 400, separatorY)
       .lineWidth(1)
       .strokeColor('#022D94')
       .stroke();
    doc.restore();

    const startY = 205;
    const lineHeight = 18;
    const colGap = 10;
    const totalWidth = 380;
    const colCount = 2;
    const colWidth = (totalWidth - colGap) / colCount;
    const perCol = Math.ceil(names.length / colCount);

    doc.font('Helvetica').fontSize(12);
    for (let col = 0; col < colCount; col++) {
      const xs = x + 20 + col * (colWidth + colGap);
      for (let row = 0; row < perCol; row++) {
        const idx = col * perCol + row;
        if (idx >= names.length) break;
        const ys = startY + row * lineHeight;
        doc.text(names[idx], xs, ys, { width: colWidth, align: 'center' });
      }
    }

    if (menu.in_fridge) {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('red')
         .text('befindet sich im Kühlschrank', x + 20, 560, { width: 380, align: 'center' });
    }

    if (fs.existsSync(logoPath)) {
      SVGtoPDF(doc, fs.readFileSync(logoPath, 'utf-8'), x + 330, 500, { width: 80 });
    }
  }

  // Gruppieren & sortieren nach Menü-Nummer, damit Reihenfolge stimmt
  const grouped = groupOrders((orders ?? []) as Order[], menus as WeekMenu[]);
  const locations: ('Nordpol' | 'Südpol')[] = ['Nordpol', 'Südpol'];

  for (const location of locations) {
    const keys = Object.keys(grouped)
      .filter(k => k.startsWith(location) && grouped[k].names.length > 0)
      .sort((a, b) => grouped[a].menu.menu_number - grouped[b].menu.menu_number);

    for (let i = 0; i < keys.length; i += 2) {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const pdfChunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => pdfChunks.push(chunk));
      doc.on('error', (err: Error) => { console.error('PDF error:', err); archive.abort(); });

      const pair = keys.slice(i, i + 2).map(k => grouped[k]);
      drawBlock(doc,   0, pair[0]);
      if (pair[1]) drawBlock(doc, 420, pair[1]);
      doc.end();

      const pdfBuffer: Buffer = await new Promise(resolve =>
        doc.on('end', () => resolve(Buffer.concat(pdfChunks)))
      );

      const menuNrLeft = pair[0].menu.menu_number;
      archive.append(pdfBuffer, { name: `Menü ${menuNrLeft} – ${location}.pdf` });
    }
  }

  await archive.finalize();

  // 5) ZIP an Client senden
  const zipBuffer = Buffer.concat(zipChunks);
  res
    .status(200)
    .setHeader('Content-Type', 'application/zip')
    .setHeader('Content-Disposition', `attachment; filename=Menue_Export_KW${isoWeek}_${isoYear}_Tag${day}.zip`)
    .send(zipBuffer);
}