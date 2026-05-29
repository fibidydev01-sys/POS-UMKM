import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client untuk Route Handler.
 * Pakai service role key agar bisa bypass RLS (RLS memang disabled,
 * tapi service role tetap diperlukan untuk operasi admin seperti
 * insert aktivasi_kode yang seharusnya hanya bisa dari server).
 *
 * JANGAN expose ke client — file ini hanya diimport dari Route Handler.
 */
export async function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
