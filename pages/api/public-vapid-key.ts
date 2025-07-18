import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Sicher aus ENV lesen!
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: "Kein VAPID Public Key gefunden." });
  res.status(200).json({ key });
}
