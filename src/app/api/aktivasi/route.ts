import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST { kode } → validasi kode, klaim, generate umkm_id,
// seed umkm_config + users table + diskon preset default.
// Tidak ada Supabase Auth — identitas via cookie umkm_id + owner_id.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak valid." }, { status: 400 });
  }

  const kode = String((body as Record<string, unknown>)?.kode || "").trim();

  if (!kode) {
    return NextResponse.json({ ok: false, pesan: "Kode aktivasi wajib diisi." }, { status: 400 });
  }

  const supabase = await createServerSupabase();

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

  // Kode sudah dipakai — toleran re-aktivasi device sama
  if (row.used && row.umkm_id) {
    // Ambil owner_id yang sudah ada
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("umkm_id", row.umkm_id)
      .eq("role", "owner")
      .eq("is_active", true)
      .maybeSingle();

    const res = NextResponse.json({
      ok: true,
      pesan: "Kode sudah aktif. Masuk kembali.",
      umkmId: row.umkm_id,
      ownerId: existingUser?.id ?? null,
    });
    setCookies(res, row.umkm_id, existingUser?.id ?? "");
    return res;
  }

  if (row.used && !row.umkm_id) {
    return NextResponse.json({ ok: false, pesan: "Kode sudah dipakai." }, { status: 409 });
  }

  // Klaim kode baru
  const umkmId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  // 1. Klaim kode
  const upd = await supabase
    .from("aktivasi_kode")
    .update({ used: true, umkm_id: umkmId, activated_at: nowIso })
    .eq("id", row.id)
    .eq("used", false);

  if (upd.error) {
    return NextResponse.json({ ok: false, pesan: "Gagal mengaktifkan kode." }, { status: 500 });
  }

  // 2. Seed umkm_config
  const { error: configErr } = await supabase
    .from("umkm_config")
    .upsert(
      { umkm_id: umkmId, app_version: row.version_access || "v1" },
      { onConflict: "umkm_id" }
    );

  if (configErr) {
    return NextResponse.json({ ok: false, pesan: "Gagal seed config." }, { status: 500 });
  }

  // 3. Seed users — satu row owner, tanpa auth_id
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .upsert(
      {
        umkm_id: umkmId,
        username: "owner",
        role: "owner",
        is_active: true,
      },
      { onConflict: "umkm_id,username" }
    )
    .select("id")
    .single();

  if (userErr || !userRow) {
    return NextResponse.json({ ok: false, pesan: "Gagal seed user." }, { status: 500 });
  }

  const ownerId = userRow.id;

  // 4. Seed diskon preset default (hanya kalau belum ada)
  const { data: existingPreset } = await supabase
    .from("diskon_preset")
    .select("id")
    .eq("umkm_id", umkmId)
    .limit(1);

  if (!existingPreset || existingPreset.length === 0) {
    await supabase.from("diskon_preset").insert([
      { umkm_id: umkmId, nama: "Diskon 5%", persen: 5, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 10%", persen: 10, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 15%", persen: 15, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 20%", persen: 20, is_active: true, updated_by: ownerId },
    ]);
  }

  const res = NextResponse.json({
    ok: true,
    pesan: "Aktivasi berhasil.",
    umkmId,
    ownerId,
  });
  setCookies(res, umkmId, ownerId);
  return res;
}

function setCookies(res: NextResponse, umkmId: string, ownerId: string) {
  const opts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 tahun
    sameSite: "lax" as const,
  };
  res.cookies.set("umkm_id", umkmId, opts);
  if (ownerId) res.cookies.set("owner_id", ownerId, opts);
}