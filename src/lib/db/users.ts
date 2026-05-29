import { supabase } from "../supabase/client";

// Owner-only: tidak ada multi-user, tidak ada Supabase Auth.
// getCurrentUser membaca cookie owner_id → query users by id.
// Tidak ada fungsi tambahUser, resetPin, nonaktifkanUser, getUsers.

export interface CurrentUser {
  id: string;       // users.id — dipakai sebagai kasir_id, updated_by, void_by
  umkm_id: string;
  username: string;
  role: "owner" | "kasir" | "system";
  is_active: boolean;
}

export interface User {
  id: string;
  umkm_id: string;
  username: string;
  role: "owner" | "kasir" | "system";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Ambil owner yang sedang aktif berdasarkan cookie owner_id.
 * Return null kalau cookie tidak ada atau row tidak ditemukan.
 *
 * Dipanggil di setiap page untuk dapat umkm_id + user.id.
 * Kalau null → redirect ke /aktivasi.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Baca owner_id dari cookie (client-side)
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)owner_id=([^;]+)/);
  const ownerId = match ? decodeURIComponent(match[1]) : null;
  if (!ownerId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, umkm_id, username, role, is_active")
    .eq("id", ownerId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as CurrentUser;
}
