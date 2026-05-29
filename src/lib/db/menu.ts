import { supabase } from "../supabase/client";

export interface Kategori {
  id: string;
  umkm_id: string;
  nama: string;
  urutan: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  umkm_id: string;
  kategori_id: string | null;
  nama: string;
  harga: number;
  tersedia: boolean;
  urutan: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItemInput {
  kategori_id: string | null;
  nama: string;
  harga: number;
  tersedia: boolean;
}

// ── Kategori ─────────────────────────────────────────────────
export async function getKategori(umkmId: string): Promise<Kategori[]> {
  const { data, error } = await supabase
    .from("kategori")
    .select("*")
    .eq("umkm_id", umkmId)
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
  const { error } = await supabase.from("kategori").update({ nama: nama.trim() }).eq("id", id);
  if (error) throw error;
}

export async function hapusKategori(id: string): Promise<void> {
  // menu_item.kategori_id ON DELETE SET NULL → menu tetap ada tanpa kategori.
  const { error } = await supabase.from("kategori").delete().eq("id", id);
  if (error) throw error;
}

// ── Menu item ────────────────────────────────────────────────
export async function getMenuItems(umkmId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_item")
    .select("*")
    .eq("umkm_id", umkmId)
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export async function getMenuTersedia(umkmId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_item")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("tersedia", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export async function tambahMenuItem(umkmId: string, input: MenuItemInput): Promise<void> {
  const { error } = await supabase.from("menu_item").insert({
    umkm_id: umkmId,
    kategori_id: input.kategori_id,
    nama: input.nama.trim(),
    harga: Math.round(input.harga),
    tersedia: input.tersedia,
  });
  if (error) throw error;
}

export async function updateMenuItem(id: string, input: MenuItemInput): Promise<void> {
  const { error } = await supabase
    .from("menu_item")
    .update({
      kategori_id: input.kategori_id,
      nama: input.nama.trim(),
      harga: Math.round(input.harga),
      tersedia: input.tersedia,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleTersedia(id: string, tersedia: boolean): Promise<void> {
  const { error } = await supabase
    .from("menu_item")
    .update({ tersedia, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function hapusMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_item").delete().eq("id", id);
  if (error) throw error;
}
