// pages/api/send-order-reminder.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
const webpush = require('web-push');

// Typisierung für Caterer-Namen
type CatererKey = 'Dean&David' | 'Merkel' | 'Bloi';

// Fristen in Millisekunden
const CATERER_DEADLINES: Record<CatererKey, number> = {
  'Dean&David': 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 4, // 7 Tage + 4 Stunden
  'Merkel':     1000 * 60 * 60 * 24 * 1 + 1000 * 60 * 60 * 4, // 1 Tag + 4 Stunden
  'Bloi':       1000 * 60 * 60 * 24 * 1 + 1000 * 60 * 60 * 4  // 1 Tag + 4 Stunden
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  'mailto:info@example.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Hole die Push-Subscriptions & User
  const { data: subs, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys, user_id');

  if (subError) return res.status(500).json({ error: subError.message });

  // Hole alle Caterer
  const { data: caterers, error: catererError } = await supabase
    .from('caterers')
    .select('id, name');

  if (catererError) return res.status(500).json({ error: catererError.message });

  // Hole alle relevanten week_menus (deren Frist jetzt fällig ist)
  const reminders: { caterer: string; description: string; order_deadline: string }[] = [];

  for (const caterer of caterers || []) {
    const deadlineMs = CATERER_DEADLINES[(caterer.name as CatererKey)];
    if (!deadlineMs) continue;

    // Zeitpunkt, an dem die Notification gesendet werden soll
    const reminderTime = new Date(Date.now() + deadlineMs);

    const { data: menus } = await supabase
      .from('week_menus')
      .select('id, description, order_deadline, caterer_id')
      .eq('caterer_id', caterer.id)
      .gte('order_deadline', new Date().toISOString())
      .lte('order_deadline', reminderTime.toISOString());

    if (menus && menus.length) {
      reminders.push(...menus.map(m => ({
        caterer: caterer.name,
        description: m.description,
        order_deadline: m.order_deadline
      })));
    }
  }

  // Falls keine Erinnerungen nötig sind:
  if (!reminders.length) return res.status(200).json({ ok: true, sent: 0 });

  // Schicke die Notifications an alle User (hier ggf. filtern nach Standort etc.)
  let sent = 0;
  for (const sub of subs || []) {
    for (const menu of reminders) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          JSON.stringify({
            title: `Erinnerung: ${menu.caterer}`,
            body: `Die Bestellfrist für "${menu.description}" (${menu.caterer}) endet bald!`,
            icon: '/favicon.ico',
            url: 'https://food-order-app-theta-eight.vercel.app' // Vollständige URL!
          })
        );
        sent++;
      } catch (err) {
        // Fehler loggen oder ignorieren
        // console.error('Push Error:', err);
      }
    }
  }

  res.status(200).json({ ok: true, sent });
}
export const config = {
  runtime: 'nodejs',
  };