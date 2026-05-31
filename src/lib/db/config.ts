import { supabase } from "../supabase/client";

export interface UmkmConfig {
  id: string;
  umkm_id: string;
  nama_umkm: string;
  alamat: string;
  no_telp: string;
  footer_struk: string;
  app_version: string;
  created_at: string;
  updated_at: string;
}

export interface UmkmProfilInput {
  nama_umkm: string;
  alamat: string;
  no_telp: string;
  footer_struk: string;
}

export async function getConfig(umkmId: string): Promise<UmkmConfig | null> {
  const { data, error } = await supabase
    .from("umkm_config").select("*").eq("umkm_id", umkmId).maybeSingle();
  if (error) throw error;
  return data as UmkmConfig | null;
}

export async function updateProfil(umkmId: string, input: UmkmProfilInput): Promise<void> {
  const { error } = await supabase.from("umkm_config").upsert(
    {
      umkm_id: umkmId,
      nama_umkm: input.nama_umkm.trim(),
      alamat: input.alamat.trim(),
      no_telp: input.no_telp.trim(),
      footer_struk: input.footer_struk,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "umkm_id" }
  );
  if (error) throw error;
}
