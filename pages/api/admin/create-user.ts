// pages/api/admin/create-user.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Niemals Service Role Key ins Frontend packen!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // NUR im Backend!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, role, first_name, last_name, location } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  // 1. Auth User anlegen
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: role || "user" }
  });

  if (error || !data.user) return res.status(400).json({ error: error?.message || "Auth error" });

  // 2. Profile-Tabelle befüllen (mit der user.id aus Auth!)
  const { error: profErr } = await supabase.from("profiles").insert({
    id: data.user.id,
    first_name: first_name || "",
    last_name: last_name || "",
    location: location || "",
    role: role || "user"
  });

  if (profErr) return res.status(400).json({ error: profErr.message });

  res.status(200).json({ user: data.user });
}
