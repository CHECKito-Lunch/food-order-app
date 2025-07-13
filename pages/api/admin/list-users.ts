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
      // TS-Hack für Supabase Paging (page erwartet number, bekommt aber eigentlich string-token)
      const { data, error } = await supabase.auth.admin.listUsers({
        page: nextPageToken as unknown as number,
        perPage: 1000,
      });

      if (error) throw error;
      const users = data?.users ?? [];
      allUsers = allUsers.concat(users);
      nextPageToken = (data as any).next_page_token ?? undefined;
    } while (nextPageToken);

    return res.status(200).json({ users: allUsers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}