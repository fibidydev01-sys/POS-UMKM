import { NextRequest, NextResponse } from "next/server";
import { getCredentialByProvider } from "@/lib/db/pg-credentials";
import { getAdapter, isProvider } from "@/lib/payment/registry";
import type { PGCredential } from "@/lib/payment/types";

// Test koneksi: kalau apiKey dikirim (form belum disimpan) → tes nilai itu (transient).
// Kalau tidak → tes credential tersimpan utk provider tsb. Key tidak pernah dikembalikan.
export async function POST(request: NextRequest) {
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.json({ ok: false, message: "Sesi tidak ditemukan." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const provider = String(body.provider ?? "");
  if (!isProvider(provider)) {
    return NextResponse.json({ ok: false, message: "Provider tidak didukung." }, { status: 400 });
  }

  const apiKey = body.apiKey ? String(body.apiKey) : "";
  const mode = (String(body.mode ?? "sandbox") === "production" ? "production" : "sandbox") as
    | "sandbox"
    | "production";
  const webhookToken = body.webhookToken ? String(body.webhookToken) : undefined;

  let cred: PGCredential | null;
  if (apiKey.trim()) {
    cred = { provider, apiKey: apiKey.trim(), mode, webhookToken };
  } else {
    cred = await getCredentialByProvider(umkmId, provider);
    if (!cred) {
      return NextResponse.json(
        { ok: false, message: "Belum ada credential tersimpan untuk provider ini." },
        { status: 400 }
      );
    }
  }

  const result = await getAdapter(cred).testConnection();
  return NextResponse.json({ ok: result.ok, message: result.message });
}
