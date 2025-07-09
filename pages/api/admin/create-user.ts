// pages/api/admin/create-user.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Achtung: SERVICE_ROLE_KEY NIEMALS im Browser verwenden!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // liegt nur im Backend!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  // User anlegen (keine Bestätigungsmail)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: role || "user" }
  });

  if (error) return res.status(400).json({ error: error.message });

  res.status(200).json({ user: data.user });
}
