// pages/api/admin/update-user.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { id, email, password, first_name, last_name, location, role } = req.body;
  if (!id) return res.status(400).json({ error: "Missing user id" });

  // Update Auth-Daten
  if (email || password) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
      ...(email && { email }),
      ...(password && { password }),
      user_metadata: { role }
    });
    if (authErr) return res.status(400).json({ error: authErr.message });
  }

  // Update Profil
  const { error: profErr } = await supabase.from("profiles").update({
    first_name, last_name, location, role
  }).eq("id", id);
  if (profErr) return res.status(400).json({ error: profErr.message });

  res.status(200).json({ ok: true });
}
