import { NextRequest, NextResponse } from "next/server";
import { getActiveCredential } from "@/lib/db/pg-credentials";
import { getAdapter } from "@/lib/payment/registry";
import {
  createSession, findActivePending, markStatus,
} from "@/lib/db/payment-session";
import { buildTransaksiPayload, type CartItem } from "@/lib/db/transaksi";

// L2/L3 — buat QRIS dinamis lewat PG tenant. QRIS only (R1). Service-role di server (R3).
export async function POST(request: NextRequest) {
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.json({ ok: false, pesan: "Sesi tidak ditemukan." }, { status: 401 });
  }
  // kasir_id = cookie owner_id (sumber yang SAMA dipakai jalur cash `simpanTransaksi`,
  // yaitu user.id). Disimpan ke session → dipakai webhook saat membuat transaksi.
  const kasirId = request.cookies.get("owner_id")?.value ?? null;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak valid." }, { status: 400 });
  }

  const cart = (body.cart ?? []) as CartItem[];
  const diskonPresetId = (body.diskonPresetId as string | null) ?? null;
  const diskonPersen = Number(body.diskonPersen ?? 0);
  const label = String(body.label ?? "POS UMKM");

  if (!Array.isArray(cart) || cart.length === 0) {
    return NextResponse.json({ ok: false, pesan: "Keranjang kosong." }, { status: 400 });
  }

  // Nominal dihitung SERVER-SIDE dengan builder yang SAMA dipakai webhook saat insert
  // transaksi → nominal QR == grand_total tercatat (hindari selisih pembulatan per-item).
  const { grandTotal } = buildTransaksiPayload({
    umkmId,
    kasirId: kasirId ?? "",
    transaksiId: "",
    nomorOrder: "",
    cart,
    diskonHeaderPresetId: diskonPresetId,
    diskonHeaderPersen: diskonPersen,
    paymentMethod: "qris",
    uangDiterima: null,
    validMenuIds: new Set(),
  });
  if (grandTotal <= 0) {
    return NextResponse.json({ ok: false, pesan: "Total belanja tidak valid." }, { status: 400 });
  }

  // ── Idempotency (R6) ──
  const pending = await findActivePending(umkmId);
  if (pending) {
    if (pending.amount === grandTotal) {
      // Double-click / refresh → kembalikan session yang sama (bukan invoice baru).
      return ok(pending.id, pending.provider, pending.qr_string, pending.qr_url, pending.expires_at);
    }
    // Order berubah → kadaluarsakan yang lama, buat baru.
    await markStatus(pending.id, "expired", true);
  }

  const cred = await getActiveCredential(umkmId);
  if (!cred) {
    return NextResponse.json(
      { ok: false, pesan: "Belum ada Payment Gateway aktif. Atur di Pengaturan → Pembayaran." },
      { status: 400 }
    );
  }

  const sessionId = crypto.randomUUID();
  const adapter = getAdapter(cred);

  let qr;
  try {
    qr = await adapter.createQris({ amount: grandTotal, orderId: sessionId, label });
  } catch (e) {
    return NextResponse.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal membuat QR di gateway." },
      { status: 502 }
    );
  }

  try {
    const session = await createSession({
      id: sessionId,
      umkmId,
      provider: cred.provider,
      externalId: qr.external_id,
      qrString: qr.qr_string,
      qrUrl: qr.qr_url,
      amount: grandTotal,
      kasirId,
      cartSnapshot: { cart, diskonPresetId, diskonPersen },
      expiresAt: qr.expires_at,
    });
    return ok(session.id, session.provider, session.qr_string, session.qr_url, session.expires_at);
  } catch {
    // Race idempotency: unique index pending menolak → ambil yang sudah ada.
    const existing = await findActivePending(umkmId);
    if (existing) return ok(existing.id, existing.provider, existing.qr_string, existing.qr_url, existing.expires_at);
    return NextResponse.json({ ok: false, pesan: "Gagal menyimpan sesi pembayaran." }, { status: 500 });
  }
}

function ok(
  sessionId: string,
  provider: string,
  qrString: string,
  qrUrl: string | null,
  expiresAt: string
) {
  return NextResponse.json({
    ok: true,
    sessionId,
    provider,
    qr_string: qrString,
    qr_url: qrUrl,
    expires_at: expiresAt,
  });
}
