// pages/api/admin/list-users.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let allUsers: any[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      // Die API von Supabase unterstützt paging, aber das Property heißt manchmal unterschiedlich:
      // Aktuell (Juli 2024) => "next_page_token"
      // Wir holen 1000 User pro Seite (maximal erlaubt)
      // "page" und "perPage" funktionieren in einigen Clients, aber falls nicht, nutze nur "nextPageToken"
      const { data, error } = await supabase.auth.admin.listUsers({
        page: nextPageToken,
        perPage: 1000,
      });

      if (error) throw error;
      const users = data?.users ?? [];
      allUsers = allUsers.concat(users);
      nextPageToken = (data as any).next_page_token || undefined;
    } while (nextPageToken);

    return res.status(200).json({ users: allUsers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
