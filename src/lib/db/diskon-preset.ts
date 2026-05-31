import { supabase } from "../supabase/client";

export interface DiskonPreset {
  id: string;
  umkm_id: string;
  nama: string;
  persen: number;
  is_active: boolean;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface DiskonPresetInput {
  nama: string;
  persen: number;
}

export async function getDiskonPreset(umkmId: string): Promise<DiskonPreset[]> {
  const { data, error } = await supabase
    .from("diskon_preset").select("*").eq("umkm_id", umkmId).eq("is_active", true)
    .order("persen", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DiskonPreset[];
}

export async function getAllDiskonPreset(umkmId: string): Promise<DiskonPreset[]> {
  const { data, error } = await supabase
    .from("diskon_preset").select("*").eq("umkm_id", umkmId)
    .order("persen", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DiskonPreset[];
}

export async function tambahDiskonPreset(umkmId: string, input: DiskonPresetInput, updatedBy: string): Promise<void> {
  const { error } = await supabase.from("diskon_preset").insert({
    umkm_id: umkmId, nama: input.nama.trim(), persen: input.persen, is_active: true, updated_by: updatedBy,
  });
  if (error) throw error;
}

export async function updateDiskonPreset(id: string, input: DiskonPresetInput, updatedBy: string): Promise<void> {
  const { error } = await supabase.from("diskon_preset").update({
    nama: input.nama.trim(), persen: input.persen, updated_by: updatedBy, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function hapusDiskonPreset(id: string, updatedBy: string): Promise<void> {
  const { error } = await supabase.from("diskon_preset").update({
    is_active: false, updated_by: updatedBy, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}
