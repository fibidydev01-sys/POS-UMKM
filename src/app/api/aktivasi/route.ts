import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, pesan: "Permintaan tidak valid." }, { status: 400 }); }

  const kode = String((body as Record<string, unknown>)?.kode || "").trim();
  if (!kode) return NextResponse.json({ ok: false, pesan: "Kode aktivasi wajib diisi." }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: row, error } = await supabase.from("aktivasi_kode").select("*").eq("kode", kode).maybeSingle();
  if (error) return NextResponse.json({ ok: false, pesan: "Gagal menghubungi server." }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, pesan: "Kode tidak ditemukan." }, { status: 404 });

  // ── Kode sudah pernah dipakai & sudah punya umkm_id → ini SELLER LAMA. ──
  if (row.used && row.umkm_id) {
    // [FIX B6] Pastikan owner ADA. Kalau baris owner hilang, re-create —
    // kalau tidak, ownerId null → cookie owner_id tak terset → getCurrentUser()
    // null → dashboard redirect ke /aktivasi → loop.
    let { data: existingUser } = await supabase
      .from("users").select("id")
      .eq("umkm_id", row.umkm_id).eq("role", "owner").eq("is_active", true)
      .maybeSingle();

    if (!existingUser) {
      const { data: recreated } = await supabase
        .from("users")
        .upsert(
          { umkm_id: row.umkm_id, username: "owner", role: "owner", is_active: true },
          { onConflict: "umkm_id,username" }
        )
        .select("id")
        .single();
      existingUser = recreated ?? null;
    }

    // [FIX B1] Cek apakah profil sudah lengkap. Client pakai flag ini untuk
    // memutuskan: langsung ke /dashboard (data lama tampil) ATAU isi profil.
    // Datanya MEMANG sudah tersimpan — yang dulu salah cuma flow UI-nya.
    const { data: cfg } = await supabase
      .from("umkm_config").select("nama_umkm")
      .eq("umkm_id", row.umkm_id).maybeSingle();
    const profilLengkap = !!(cfg?.nama_umkm && cfg.nama_umkm.trim());

    const res = NextResponse.json({
      ok: true,
      returning: true,          // <-- penanda: ini user lama
      profilLengkap,            // <-- true kalau nama_umkm sudah ada
      pesan: "Kode sudah aktif. Masuk kembali.",
      umkmId: row.umkm_id,
      ownerId: existingUser?.id ?? null,
    });
    setCookies(res, row.umkm_id, existingUser?.id ?? "");
    return res;
  }

  if (row.used && !row.umkm_id) return NextResponse.json({ ok: false, pesan: "Kode sudah dipakai." }, { status: 409 });

  // ── Aktivasi BARU ──
  const umkmId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const upd = await supabase.from("aktivasi_kode").update({ used: true, umkm_id: umkmId, activated_at: nowIso }).eq("id", row.id).eq("used", false);
  if (upd.error) return NextResponse.json({ ok: false, pesan: "Gagal mengaktifkan kode." }, { status: 500 });

  const { error: configErr } = await supabase.from("umkm_config").upsert({ umkm_id: umkmId, app_version: row.version_access || "v1" }, { onConflict: "umkm_id" });
  if (configErr) return NextResponse.json({ ok: false, pesan: "Gagal seed config." }, { status: 500 });

  const { data: userRow, error: userErr } = await supabase.from("users").upsert({ umkm_id: umkmId, username: "owner", role: "owner", is_active: true }, { onConflict: "umkm_id,username" }).select("id").single();
  if (userErr || !userRow) return NextResponse.json({ ok: false, pesan: "Gagal seed user." }, { status: 500 });

  const ownerId = userRow.id;
  const { data: existingPreset } = await supabase.from("diskon_preset").select("id").eq("umkm_id", umkmId).limit(1);
  if (!existingPreset || existingPreset.length === 0) {
    await supabase.from("diskon_preset").insert([
      { umkm_id: umkmId, nama: "Diskon 5%", persen: 5, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 10%", persen: 10, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 15%", persen: 15, is_active: true, updated_by: ownerId },
      { umkm_id: umkmId, nama: "Diskon 20%", persen: 20, is_active: true, updated_by: ownerId },
    ]);
  }

  const res = NextResponse.json({ ok: true, returning: false, profilLengkap: false, pesan: "Aktivasi berhasil.", umkmId, ownerId });
  setCookies(res, umkmId, ownerId);
  return res;
}

function setCookies(res: NextResponse, umkmId: string, ownerId: string) {
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365 * 5, sameSite: "lax" as const };
  res.cookies.set("umkm_id", umkmId, opts);
  if (ownerId) res.cookies.set("owner_id", ownerId, opts);
}
