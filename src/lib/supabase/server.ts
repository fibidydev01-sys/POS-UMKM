import { createClient } from "@supabase/supabase-js";

// Server-side Supabase (dipakai di Route Handler / Server Action).
// Dibuat per-request. Tetap tanpa auth — scoping via umkm_id.
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
