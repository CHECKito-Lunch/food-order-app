// pages/api/admin/create-user.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Niemals Service-Role-Key im Browser verwenden!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, role, first_name = "", last_name = "", location = "" } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  // User im Auth-Backend anlegen (ohne Bestätigungsmail)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: role || "user" }
  });

  if (error) return res.status(400).json({ error: error.message });
  const userId = data.user?.id;
  if (!userId) return res.status(400).json({ error: "No user id returned" });

  // Prüfe ob Profil schon existiert:
  const { data: existing, error: checkErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (checkErr) {
    return res.status(500).json({ error: checkErr.message });
  }

  if (!existing) {
    // Profil anlegen (nur falls noch nicht da)
    const { error: insertErr } = await supabase.from("profiles").insert({
      id: userId,
      first_name,
      last_name,
      location,
      role: role || "user"
    });
    if (insertErr) return res.status(400).json({ error: insertErr.message });
  }

  res.status(200).json({ user: data.user });
}
