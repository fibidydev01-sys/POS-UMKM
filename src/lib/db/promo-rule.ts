import { supabase } from "../supabase/client";

export interface PromoRule {
  id: string;
  umkm_id: string;
  menu_item_id: string;
  tipe_promo: "bogo" | "buy2get1";
  qty_beli: number;
  qty_gratis: number;
  is_active: boolean;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface PromoRuleInput {
  menu_item_id: string;
  tipe_promo: "bogo" | "buy2get1";
  berlaku_mulai: string;
  berlaku_sampai: string | null;
}

// qty_beli dan qty_gratis ditentukan dari tipe_promo — bukan input manual
const PROMO_CONFIG: Record<string, { qty_beli: number; qty_gratis: number }> = {
  bogo:    { qty_beli: 1, qty_gratis: 1 },
  buy2get1: { qty_beli: 2, qty_gratis: 1 },
};

/**
 * Ambil semua promo yang aktif saat ini.
 * Dipanggil saat kasir load halaman — di-cache di state kasir.
 */
export async function getPromoAktif(umkmId: string): Promise<PromoRule[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("promo_rule")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("is_active", true)
    .lte("berlaku_mulai", now)
    .or(`berlaku_sampai.is.null,berlaku_sampai.gt.${now}`);
  if (error) throw error;
  return (data ?? []) as PromoRule[];
}

/** Semua promo rule termasuk yang nonaktif/expired — untuk halaman pengaturan owner. */
export async function getAllPromoRule(umkmId: string): Promise<PromoRule[]> {
  const { data, error } = await supabase
    .from("promo_rule")
    .select("*")
    .eq("umkm_id", umkmId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromoRule[];
}

export async function tambahPromoRule(
  umkmId: string,
  input: PromoRuleInput,
  updatedBy: string
): Promise<void> {
  const cfg = PROMO_CONFIG[input.tipe_promo];
  if (!cfg) throw new Error("Tipe promo tidak valid");

  const { error } = await supabase.from("promo_rule").insert({
    umkm_id: umkmId,
    menu_item_id: input.menu_item_id,
    tipe_promo: input.tipe_promo,
    qty_beli: cfg.qty_beli,
    qty_gratis: cfg.qty_gratis,
    is_active: true,
    berlaku_mulai: input.berlaku_mulai,
    berlaku_sampai: input.berlaku_sampai,
    updated_by: updatedBy,
  });
  if (error) throw error;
}

export async function updatePromoRule(
  id: string,
  input: Pick<PromoRuleInput, "berlaku_mulai" | "berlaku_sampai">,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("promo_rule")
    .update({
      berlaku_mulai: input.berlaku_mulai,
      berlaku_sampai: input.berlaku_sampai,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Soft delete — is_active = false. */
export async function hapusPromoRule(id: string, updatedBy: string): Promise<void> {
  const { error } = await supabase
    .from("promo_rule")
    .update({ is_active: false, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
