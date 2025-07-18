import type { NextApiRequest, NextApiResponse } from 'next';

// Beispiel: Speicherung in Supabase-Tabelle 'push_subscriptions'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Nur für Server Side!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });
  const { endpoint, keys, user } = req.body;

  // Optional: Validierung
  if (!endpoint || !keys || !user?.id) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Insert/Upsert in eigene Tabelle
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
