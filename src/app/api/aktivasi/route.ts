import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST { kode } → validasi kode, klaim, generate umkm_id, set cookie.
export async function POST(request: NextRequest) {
  let kode = "";
  try {
    const body = await request.json();
    kode = String(body?.kode || "").trim();
  } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak valid." }, { status: 400 });
  }

  if (!kode) {
    return NextResponse.json({ ok: false, pesan: "Kode aktivasi wajib diisi." }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // Cari kode yang belum dipakai
  const { data: row, error } = await supabase
    .from("aktivasi_kode")
    .select("*")
    .eq("kode", kode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, pesan: "Gagal menghubungi server." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, pesan: "Kode tidak ditemukan." }, { status: 404 });
  }

  // Sudah dipakai → tetap kembalikan umkm_id-nya (toleran re-login device sama)
  let umkmId: string = row.umkm_id;
  if (row.used && umkmId) {
    const res = NextResponse.json({ ok: true, pesan: "Kode sudah aktif. Masuk kembali.", umkmId });
    setCookie(res, umkmId);
    return res;
  }
  if (row.used && !umkmId) {
    return NextResponse.json({ ok: false, pesan: "Kode sudah dipakai." }, { status: 409 });
  }

  // Klaim kode baru
  umkmId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const upd = await supabase
    .from("aktivasi_kode")
    .update({ used: true, umkm_id: umkmId, activated_at: nowIso })
    .eq("id", row.id)
    .eq("used", false); // guard agar tidak balapan
  if (upd.error) {
    return NextResponse.json({ ok: false, pesan: "Gagal mengaktifkan kode." }, { status: 500 });
  }

  // Siapkan baris config kosong utk UMKM ini
  await supabase
    .from("umkm_config")
    .upsert({ umkm_id: umkmId, app_version: row.version_access || "v1" }, { onConflict: "umkm_id" });

  const res = NextResponse.json({ ok: true, pesan: "Aktivasi berhasil.", umkmId });
  setCookie(res, umkmId);
  return res;
}

function setCookie(res: NextResponse, umkmId: string) {
  // Tidak httpOnly: dibaca client untuk scoping query (umkm_id bukan kredensial rahasia).
  res.cookies.set("umkm_id", umkmId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 tahun
    sameSite: "lax",
  });
}
