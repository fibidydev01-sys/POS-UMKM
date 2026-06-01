import { NextRequest, NextResponse } from "next/server";
import { getById, markStatus } from "@/lib/db/payment-session";
import { createServerSupabase } from "@/lib/supabase/server";

// Polling status (UX). Webhook tetap sumber kebenaran pembuatan transaksi (R8).
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

  // Kalau sudah paid & transaksi sudah dibuat webhook → kirim struk untuk ditampilkan.
  let struk: { trx: unknown; items: unknown[] } | null = null;
  if (status === "paid" && session.transaksi_id) {
    struk = await fetchStruk(session.umkm_id, session.transaksi_id);
  }

  return NextResponse.json({
    ok: true,
    status,
    expires_at: session.expires_at,
    transaksi_id: session.transaksi_id,
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
