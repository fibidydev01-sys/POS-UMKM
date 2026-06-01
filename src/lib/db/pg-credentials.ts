// ─────────────────────────────────────────────────────────────────────────────
// V3 Payment — DB access untuk pg_credentials. SERVER-ONLY (service role).
// Anon TIDAK boleh menyentuh tabel ini (R3). Plaintext key tidak pernah keluar.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabase } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/payment/crypto";
import type { PGCredential, Provider } from "@/lib/payment/types";

export interface CredentialMeta {
  provider: Provider;
  mode: "sandbox" | "production";
  is_active: boolean;
  has_webhook_token: boolean;
  updated_at: string;
}

/** Daftar credential tenant TANPA key (aman dikirim ke client). */
export async function listCredentialMeta(umkmId: string): Promise<CredentialMeta[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("pg_credentials")
    .select("provider, mode, is_active, webhook_token, updated_at")
    .eq("umkm_id", umkmId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    provider: r.provider as Provider,
    mode: r.mode as "sandbox" | "production",
    is_active: !!r.is_active,
    has_webhook_token: !!r.webhook_token,
    updated_at: r.updated_at as string,
  }));
}

/** Kredensial AKTIF tenant (sudah di-decrypt). null kalau belum setup. */
export async function getActiveCredential(umkmId: string): Promise<PGCredential | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("pg_credentials")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToCredential(data);
}

/** Kredensial per-provider (dipakai webhook untuk verify signature). */
export async function getCredentialByProvider(
  umkmId: string,
  provider: Provider
): Promise<PGCredential | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("pg_credentials")
    .select("*")
    .eq("umkm_id", umkmId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToCredential(data);
}

interface SaveArgs {
  umkmId: string;
  provider: Provider;
  apiKey: string;            // plaintext — akan dienkripsi di sini
  mode: "sandbox" | "production";
  webhookToken?: string;
  setActive?: boolean;
}

/** Simpan/replace kredensial (enkripsi at-rest). Opsional langsung aktifkan. */
export async function saveCredential(args: SaveArgs): Promise<void> {
  const supabase = await createServerSupabase();
  const enc = encryptSecret(args.apiKey);

  // Kalau diaktifkan, nonaktifkan provider lain dulu (hanya 1 aktif per tenant).
  if (args.setActive) {
    const { error: deErr } = await supabase
      .from("pg_credentials")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("umkm_id", args.umkmId);
    if (deErr) throw deErr;
  }

  const { error } = await supabase.from("pg_credentials").upsert(
    {
      umkm_id: args.umkmId,
      provider: args.provider,
      key_ciphertext: enc.key_ciphertext,
      key_iv: enc.key_iv,
      key_auth_tag: enc.key_auth_tag,
      mode: args.mode,
      webhook_token: args.webhookToken ?? null,
      is_active: !!args.setActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "umkm_id,provider" }
  );
  if (error) throw error;
}

export async function setActiveProvider(umkmId: string, provider: Provider): Promise<void> {
  const supabase = await createServerSupabase();
  const { error: deErr } = await supabase
    .from("pg_credentials")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("umkm_id", umkmId);
  if (deErr) throw deErr;
  const { error } = await supabase
    .from("pg_credentials")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("umkm_id", umkmId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function deleteCredential(umkmId: string, provider: Provider): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("pg_credentials")
    .delete()
    .eq("umkm_id", umkmId)
    .eq("provider", provider);
  if (error) throw error;
}

function rowToCredential(data: Record<string, unknown>): PGCredential {
  const apiKey = decryptSecret({
    key_ciphertext: String(data.key_ciphertext),
    key_iv: String(data.key_iv),
    key_auth_tag: String(data.key_auth_tag),
  });
  return {
    provider: data.provider as Provider,
    apiKey,
    mode: data.mode as "sandbox" | "production",
    webhookToken: (data.webhook_token as string | null) ?? undefined,
  };
}
