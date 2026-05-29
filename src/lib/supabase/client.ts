"use client";

import { createClient } from "@supabase/supabase-js";

// Owner-only: tidak ada Supabase Auth, tidak ada session management.
// RLS disabled — isolasi tenant via .eq('umkm_id', ...) di setiap query.
// Identitas: cookie umkm_id + cookie owner_id (di-set saat aktivasi).

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
