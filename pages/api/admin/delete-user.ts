// pages/api/admin/delete-user.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing user id" });

  // Lösche aus Auth
  const { error: authErr } = await supabase.auth.admin.deleteUser(id);
  if (authErr) return res.status(400).json({ error: authErr.message });

  // Lösche Profil
  await supabase.from("profiles").delete().eq("id", id);

  res.status(200).json({ ok: true });
}
