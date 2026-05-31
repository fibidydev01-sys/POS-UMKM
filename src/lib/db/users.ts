import { supabase } from "../supabase/client";

export interface CurrentUser {
  id: string;
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)owner_id=([^;]+)/);
  const ownerId = match ? decodeURIComponent(match[1]) : null;
  if (!ownerId) return null;
  const { data, error } = await supabase
    .from("users").select("id, umkm_id, username, role, is_active")
    .eq("id", ownerId).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  return data as CurrentUser;
}
