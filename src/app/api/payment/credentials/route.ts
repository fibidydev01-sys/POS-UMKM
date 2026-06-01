import { NextRequest, NextResponse } from "next/server";
import { listCredentialMeta, saveCredential } from "@/lib/db/pg-credentials";
import { isProvider } from "@/lib/payment/registry";

// GET: daftar credential (TANPA key) — aman untuk client (R3).
export async function GET(request: NextRequest) {
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.json({ ok: false, pesan: "Sesi tidak ditemukan." }, { status: 401 });
  }
  const credentials = await listCredentialMeta(umkmId);
  return NextResponse.json({ ok: true, credentials });
}

// POST: simpan/replace credential (dienkripsi at-rest). Plaintext key tidak disimpan/dikembalikan.
export async function POST(request: NextRequest) {
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.json({ ok: false, pesan: "Sesi tidak ditemukan." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak valid." }, { status: 400 });
  }

  const provider = String(body.provider ?? "");
  const apiKey = String(body.apiKey ?? "");
  const mode = String(body.mode ?? "sandbox");
  const webhookToken = body.webhookToken ? String(body.webhookToken) : undefined;
  const setActive = body.setActive !== false; // default: aktifkan

  if (!isProvider(provider)) {
    return NextResponse.json({ ok: false, pesan: "Provider tidak didukung." }, { status: 400 });
  }
  if (!apiKey.trim()) {
    return NextResponse.json({ ok: false, pesan: "API key wajib diisi." }, { status: 400 });
  }
  if (mode !== "sandbox" && mode !== "production") {
    return NextResponse.json({ ok: false, pesan: "Mode harus sandbox atau production." }, { status: 400 });
  }

  await saveCredential({
    umkmId,
    provider,
    apiKey: apiKey.trim(),
    mode,
    webhookToken,
    setActive,
  });

  return NextResponse.json({ ok: true });
}
