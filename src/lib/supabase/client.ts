"use client";

import { createClient } from "@supabase/supabase-js";

// Client-side Supabase. Tanpa Supabase Auth — identitas via cookie umkm_id,
// scoping baris dilakukan manual dengan .eq('umkm_id', ...).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
