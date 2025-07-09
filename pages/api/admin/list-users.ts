// pages/api/admin/list-users.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Nur GET erlauben
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional: Hier könntest du noch einen Auth-Check machen, z.B. nur Admins.
  // (Sonst ist diese Route offen!)

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    // Fallback falls kein Array zurückkommt:
    const users = data?.users ?? [];
    return res.status(200).json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
