import { supabase } from "../supabase/client";

export interface Kategori {
  id: string;
  umkm_id: string;
  nama: string;
  urutan: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  umkm_id: string;
  kategori_id: string | null;
  nama: string;
  harga: number;
  is_active: boolean;    // owner control — permanen. FALSE = soft delete
  is_available: boolean; // kasir toggle harian. FALSE = stok habis hari ini
  urutan: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface MenuItemInput {
  kategori_id: string | null;
  nama: string;
  harga: number;
  is_available: boolean;
}

// ── Kategori ─────────────────────────────────────────────────

export async function getKategori(umkmId: string): Promise<Kategori[]> {
  const { data, error } = await supabase
    .from("kategori")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("is_active", true)
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Kategori[];
}

export async function tambahKategori(umkmId: string, nama: string): Promise<void> {
  const { error } = await supabase
    .from("kategori")
    .insert({ umkm_id: umkmId, nama: nama.trim() });
  if (error) throw error;
}

export async function updateKategori(id: string, nama: string): Promise<void> {
  const { error } = await supabase
    .from("kategori")
    .update({ nama: nama.trim() })
    .eq("id", id);
  if (error) throw error;
}

/** Soft delete kategori — is_active = false. */
export async function hapusKategori(id: string): Promise<void> {
  // menu_item.kategori_id ON DELETE SET NULL → menu tetap ada tanpa kategori.
  // Kategori di-hard delete karena tidak ada transaksi yang FK ke kategori.
  // Hanya menu_item yang tidak boleh hard delete.
  const { error } = await supabase.from("kategori").delete().eq("id", id);
  if (error) throw error;
}

// ── Menu item ────────────────────────────────────────────────

/**
 * Semua item aktif untuk halaman kelola menu (owner).
 * Filter is_active = true — item yang di-soft-delete tidak muncul.
 */
export async function getMenuItems(umkmId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_item")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("is_active", true)
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

/**
 * Item yang tampil di kasir screen.
 * Filter is_active = true (masih dijual) AND is_available = true (stok ada hari ini).
 */
export async function getMenuTersedia(umkmId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_item")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export async function tambahMenuItem(
  umkmId: string,
  input: MenuItemInput,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase.from("menu_item").insert({
    umkm_id: umkmId,
    kategori_id: input.kategori_id,
    nama: input.nama.trim(),
    harga: Math.round(input.harga),
    is_active: true,
    is_available: input.is_available,
    updated_by: updatedBy,
  });
  if (error) throw error;
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("menu_item")
    .update({
      kategori_id: input.kategori_id,
      nama: input.nama.trim(),
      harga: Math.round(input.harga),
      is_available: input.is_available,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Toggle ketersediaan harian oleh kasir.
 * Hanya update is_available — bukan is_active.
 */
export async function toggleTersedia(
  id: string,
  isAvailable: boolean,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("menu_item")
    .update({
      is_available: isAvailable,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Soft delete — set is_active = false.
 * Data item tetap ada selamanya untuk integritas riwayat transaksi.
 * TIDAK PERNAH hard delete menu_item.
 */
export async function hapusMenuItem(id: string, updatedBy: string): Promise<void> {
  const { error } = await supabase
    .from("menu_item")
    .update({
      is_active: false,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
