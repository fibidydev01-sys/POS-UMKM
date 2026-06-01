// ─────────────────────────────────────────────────────────────────────────────
// V3 Payment — DB access untuk payment_session. SERVER-ONLY (service role).
// Menyimpan snapshot cart untuk pembuatan transaksi pasca-paid (R8) di webhook.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabase } from "@/lib/supabase/server";
import type { CartItem } from "@/lib/db/transaksi";
import type { PaymentStatus, Provider } from "@/lib/payment/types";

/** Snapshot checkout yang cukup untuk membangun transaksi pasca-paid (R8). */
export interface CheckoutSnapshot {
  cart: CartItem[];               // final — sudah lewat promo engine
  diskonPresetId: string | null;
  diskonPersen: number;
}

export interface PaymentSession {
  id: string;
  umkm_id: string;
  provider: Provider;
  external_id: string;
  qr_string: string;
  qr_url: string | null;
  amount: number;
  kasir_id: string | null;
  status: PaymentStatus;
  cart_snapshot: CheckoutSnapshot;
  transaksi_id: string | null;
  expires_at: string;
  created_at: string;
}

interface CreateArgs {
  id: string;
  umkmId: string;
  provider: Provider;
  externalId: string;
  qrString: string;
  qrUrl?: string;
  amount: number;
  kasirId: string | null;
  cartSnapshot: CheckoutSnapshot;
  expiresAt: string;
}

export async function createSession(args: CreateArgs): Promise<PaymentSession> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_session")
    .insert({
      id: args.id,
      umkm_id: args.umkmId,
      provider: args.provider,
      external_id: args.externalId,
      qr_string: args.qrString,
      qr_url: args.qrUrl ?? null,
      amount: args.amount,
      kasir_id: args.kasirId,
      status: "pending",
      cart_snapshot: args.cartSnapshot,
      expires_at: args.expiresAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentSession;
}

/** Session pending tenant yang belum expired (untuk idempotency, R6). */
export async function findActivePending(umkmId: string): Promise<PaymentSession | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_session")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentSession) ?? null;
}

export async function getById(sessionId: string, umkmId: string): Promise<PaymentSession | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_session")
    .select("*")
    .eq("id", sessionId)
    .eq("umkm_id", umkmId)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentSession) ?? null;
}

export async function getByExternalId(
  provider: Provider,
  externalId: string
): Promise<PaymentSession | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_session")
    .select("*")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentSession) ?? null;
}

/** Update status. Guard opsional: hanya ubah kalau status saat ini `pending`. */
export async function markStatus(
  sessionId: string,
  status: PaymentStatus,
  onlyFromPending = false
): Promise<void> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from("payment_session")
    .update({ status })
    .eq("id", sessionId);
  if (onlyFromPending) q = q.eq("status", "pending").is("transaksi_id", null);
  const { error } = await q;
  if (error) throw error;
}

/** Tautkan transaksi ke session secara idempotent (hanya jika belum ada). */
export async function attachTransaksi(sessionId: string, transaksiId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_session")
    .update({ status: "paid", transaksi_id: transaksiId })
    .eq("id", sessionId)
    .is("transaksi_id", null)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0; // true = kita yang menautkan (bukan duplikat)
}
