import { NextRequest, NextResponse } from "next/server";
import { getById, markStatus } from "@/lib/db/payment-session";
import { getCredentialByProvider } from "@/lib/db/pg-credentials";
import { getAdapter } from "@/lib/payment/registry";
import { createServerSupabase } from "@/lib/supabase/server";

// Polling status (UX). Webhook tetap sumber kebenaran pembuatan transaksi (R8).
// Fallback: bila webhook telat (mis. sandbox/localhost tak bisa di-reach PG),
// tombol "Cek status" memicu adapter.checkStatus() agar 'paid' tetap terdeteksi.
export async function GET(request: NextRequest) {
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.json({ ok: false, pesan: "Sesi tidak ditemukan." }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ ok: false, pesan: "sessionId wajib." }, { status: 400 });
  }

  const session = await getById(sessionId, umkmId);
  if (!session) {
    return NextResponse.json({ ok: false, pesan: "Sesi pembayaran tidak ditemukan." }, { status: 404 });
  }

  let status = session.status;

  // Expiry lokal (R7): masih pending tapi sudah lewat TTL → tandai expired.
  // Guard `onlyFromPending` + `transaksi_id IS NULL` agar tidak menimpa paid.
  if (status === "pending" && new Date(session.expires_at).getTime() < Date.now()) {
    await markStatus(session.id, "expired", true);
    status = "expired";
  }

  // Fallback polling ke PG (hanya bila masih pending & belum ada transaksi).
  // Catatan: ini TIDAK membuat transaksi — pembuatan transaksi tetap di webhook
  // (R8). Tujuannya hanya agar UI tidak menggantung saat webhook telat: kalau PG
  // bilang sudah 'paid' tapi transaksi belum ada, UI tetap menampilkan 'pending'
  // (menunggu webhook) — kecuali transaksi sudah dibuat, baru tampil struk.
  if (status === "pending" && !session.transaksi_id) {
    try {
      const cred = await getCredentialByProvider(session.umkm_id, session.provider);
      if (cred) {
        const remote = await getAdapter(cred).checkStatus(session.external_id);
        if (remote === "expired" || remote === "failed") {
          await markStatus(session.id, remote, true);
          status = remote;
        }
        // remote === "paid": jangan ubah di sini; biarkan webhook yang menautkan
        // transaksi (R8). Re-baca sekali untuk menangkap kalau webhook baru selesai.
        if (remote === "paid") {
          const fresh = await getById(sessionId, umkmId);
          if (fresh) status = fresh.status;
        }
      }
    } catch {
      /* fallback gagal — abaikan, polling berikutnya / webhook tetap jalan */
    }
  }

  // Kalau sudah paid & transaksi sudah dibuat webhook → kirim struk untuk ditampilkan.
  let struk: { trx: unknown; items: unknown[] } | null = null;
  const fresh = status === "paid" ? await getById(sessionId, umkmId) : session;
  const transaksiId = fresh?.transaksi_id ?? session.transaksi_id;
  if (status === "paid" && transaksiId) {
    struk = await fetchStruk(session.umkm_id, transaksiId);
  }

  return NextResponse.json({
    ok: true,
    status,
    provider: session.provider,
    expires_at: session.expires_at,
    transaksi_id: transaksiId,
    struk,
  });
}

async function fetchStruk(umkmId: string, transaksiId: string) {
  const supabase = await createServerSupabase();
  const { data: trx } = await supabase
    .from("transaksi")
    .select("*")
    .eq("id", transaksiId)
    .eq("umkm_id", umkmId)
    .maybeSingle();
  if (!trx) return null;
  const { data: items } = await supabase
    .from("transaction_items")
    .select("*")
    .eq("transaksi_id", transaksiId)
    .order("id", { ascending: true });
  return { trx, items: items ?? [] };
}
