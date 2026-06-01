import { NextRequest, NextResponse } from "next/server";
import { isProvider, getAdapter, peekWebhook } from "@/lib/payment/registry";
import {
  getByExternalId, markStatus, attachTransaksi, type PaymentSession,
} from "@/lib/db/payment-session";
import { getCredentialByProvider } from "@/lib/db/pg-credentials";
import { buildTransaksiPayload, generateNomorOrder } from "@/lib/db/transaksi";
import { createServerSupabase } from "@/lib/supabase/server";
import crypto from "node:crypto";

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

// L4 — webhook publik. WAJIB verify signature (R5). Transaksi dibuat di sini (R8).
// Next 15: params adalah Promise.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  // Raw body diperlukan utk verify signature (jangan re-serialize sebelum verify).
  const raw = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  // 1) Ambil external_id TANPA secret → cari session → tenant.
  const peek = peekWebhook(provider, payload);
  if (!peek.external_id) return NextResponse.json({ ok: false }, { status: 400 });

  const session = await getByExternalId(provider, peek.external_id);
  if (!session) return NextResponse.json({ ok: false }, { status: 404 });

  // 2) Muat kredensial tenant utk verify.
  const cred = await getCredentialByProvider(session.umkm_id, provider);
  if (!cred) return NextResponse.json({ ok: false }, { status: 400 });

  // 3) VERIFY (R5). Gagal → 401, status tidak diubah.
  const adapter = getAdapter(cred);
  if (!adapter.verifyWebhook(payload, headers)) {
    return NextResponse.json({ ok: false, pesan: "signature tidak valid" }, { status: 401 });
  }

  // 4) Idempotent: kalau sudah final / sudah ada transaksi → balas 200 (replay aman).
  if (session.transaksi_id) return NextResponse.json({ ok: true });
  if (session.status === "paid" || session.status === "expired" || session.status === "failed") {
    return NextResponse.json({ ok: true });
  }

  const result = adapter.parseWebhook(payload);

  if (result.status !== "paid") {
    if (result.status === "expired" || result.status === "failed") {
      await markStatus(session.id, result.status, true);
    }
    return NextResponse.json({ ok: true });
  }

  // 5) PAID → buat transaksi (R8) secara idempotent.
  try {
    await createTransaksiFromSession(session);
  } catch (e) {
    // Balas 500 agar PG mengirim ulang (retry) — transaksi belum tercatat.
    return NextResponse.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal mencatat transaksi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function createTransaksiFromSession(session: PaymentSession): Promise<void> {
  const supabase = await createServerSupabase();
  const snap = session.cart_snapshot;
  const cart = snap.cart;

  // Validasi FK menu (UUID tak dikenal → null, sama seperti jalur cash).
  const allMenuIds = [
    ...new Set(cart.map((c) => c.menu_item_id).filter((id): id is string => id !== null)),
  ];
  const validMenuIds = new Set<string>();
  if (allMenuIds.length > 0) {
    const { data } = await supabase.from("menu_item").select("id").in("id", allMenuIds);
    for (const r of (data ?? []) as { id: string }[]) validMenuIds.add(r.id);
  }

  const kasirId = await resolveKasirId(supabase, session);
  const transaksiId = crypto.randomUUID();
  const nomorOrder = await generateNomorOrder(session.umkm_id);

  const { trxRow, itemRows } = buildTransaksiPayload({
    umkmId: session.umkm_id,
    kasirId,
    transaksiId,
    nomorOrder,
    cart,
    diskonHeaderPresetId: snap.diskonPresetId,
    diskonHeaderPersen: snap.diskonPersen,
    paymentMethod: "qris",   // R1
    uangDiterima: null,      // non-cash → tanpa kembalian
    validMenuIds,
  });

  // INSERT dulu (batch satu statement → deferred trigger lulus), lalu klaim session.
  const { error: e1 } = await supabase.from("transaksi").insert(trxRow);
  if (e1) throw e1;
  if (itemRows.length > 0) {
    const { error: e2 } = await supabase.from("transaction_items").insert(itemRows);
    if (e2) {
      await supabase.from("transaksi").delete().eq("id", transaksiId);
      throw e2;
    }
  }

  // Klaim idempotent: hanya menang kalau transaksi_id masih null.
  const claimed = await attachTransaksi(session.id, transaksiId);
  if (!claimed) {
    // Webhook lain (race) sudah menautkan transaksinya → buang duplikat milik kita.
    await supabase.from("transaksi").delete().eq("id", transaksiId);
  }
}

// kasir_id: utamakan yang tersimpan saat create (cookie owner_id); fallback ke owner tenant.
async function resolveKasirId(supabase: ServerClient, session: PaymentSession): Promise<string> {
  if (session.kasir_id) return session.kasir_id;
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("umkm_id", session.umkm_id)
    .eq("role", "owner")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;
  throw new Error("kasir_id tidak dapat ditentukan (session.kasir_id kosong & owner tidak ditemukan).");
}
