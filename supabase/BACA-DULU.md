# BACA DULU — Cara Pakai Folder `src` Fix Ini

Folder `src/` di ZIP ini **HANYA berisi file yang berubah** (9 file), bukan seluruh project.

## ⚠️ Cara replace (PENTING)
**JANGAN hapus folder `src` kamu lalu ganti dengan folder ini** — kamu akan kehilangan 60+ file lain.
Yang benar: **copy folder `src` ini menimpa `src` project kamu** (overwrite file yang path-nya sama). Di Windows: pilih `src` ini → Copy → paste ke root project `pos-umkm-mvp` → "Replace the files in the destination".

## Urutan kerja
1. **Jalankan `04-schema-final.sql` dulu** (dari ZIP audit sebelumnya) di Supabase SQL Editor. **Wajib** — fix B2 (transaksi multi-item) butuh trigger versi DEFERRABLE + FK `ON DELETE CASCADE` dari SQL itu. Tanpa SQL ini, batch insert bisa tetap error.
2. Overwrite 9 file di bawah ke `src` project.
3. `npm run lint` lalu `npm run build` (typecheck). Harusnya lolos.
4. Tes pakai skenario di `02-FLOW-SISTEM.md` §9 (A–E).

## 9 file yang diganti & fix-nya

| File | Fix |
|---|---|
| `src/app/globals.css` | **B5** — hapus `width:58mm` di blok `@media print` → cetak 80mm jadi benar 80mm. (sekalian **U12**: `--muted-foreground` digelapkan dikit untuk kontras) |
| `src/app/api/aktivasi/route.ts` | **B1 + B6** — kirim `returning` + `profilLengkap`, re-create owner kalau hilang |
| `src/components/aktivasi/aktivasi-view.tsx` | **B1** — kalau user lama & profil lengkap → `router.replace("/dashboard")`, bukan paksa isi profil |
| `src/lib/db/transaksi.ts` | **B2 + B8** — `simpanTransaksi` batch insert (UUID digenerate di client) + rollback DELETE header |
| `src/lib/export/excel.ts` | **B4** — backup ikut simpan `triggered_by_item_id` |
| `src/lib/export/import.ts` | **B4 + B7** — import baca `triggered_by_item_id`, sanitasi FK stale, tetap kompatibel backup lama |
| `src/components/shared/page-skeleton.tsx` | **U1 + U2** — skeleton kasir `max-w-2xl` + `lg:grid-cols-4` (anti layout-shift di tablet) |
| `src/components/kasir/cart-line.tsx` | **U6** — tombol qty jadi 44px (target sentuh) |
| `src/components/menu/menu-view.tsx` | **U5 + U6** — rename kategori pakai Drawer (bukan `window.prompt`) + tombol aksi 40px |

> Catatan B1: data profil kamu **selama ini sebenarnya tersimpan** di `umkm_config`. Yang salah cuma flow UI-nya (selalu lompat ke form profil kosong). Ini **bukan** RLS.

## Sisa polish kecil (TIDAK aku kirim sebagai file — edit manual 1 baris kalau mau)

Item kosmetik kecil ini cuma 1 baris, jadi tidak aku bungkus sebagai file penuh:

- **U7** keseragaman tinggi drawer:
  - `src/components/kasir/cart-panel.tsx`: `className="max-h-[92dvh]"` → `max-h-[88dvh]`
  - `src/components/riwayat/transaksi-detail.tsx`: `max-h-[90dvh]` → `max-h-[88dvh]`
- **U9** judul picker kategori: `src/components/menu/form-menu-item.tsx`, hapus `className="hidden"` di `<DrawerHeader className="hidden">` (drawer "Pilih Kategori" jadi punya judul terlihat).
- **U3** empty-state konsisten: di `src/components/pengaturan/diskon-view.tsx` & `promo-view.tsx`, blok kosong custom (`<div ...py-16>`) bisa diganti komponen `<Empty>` (lihat pemakaian di `kasir-view.tsx`). Opsional.
- **U11** sidebar: `src/components/shared/app-sidebar.tsx` masih hardcode "U"/"Owner". Untuk pakai nama usaha asli perlu ambil config (via hook). Aku skip dulu karena butuh fetch tambahan — bukan bug, cuma kosmetik.

## Yang TIDAK aku ubah (sengaja)
- `src/proxy.ts` — sudah benar untuk Next.js 16 (S2, bukan bug).
- `src/lib/supabase/server.ts` & `client.ts` — model anon+RLS-off diterima untuk MVP 1-device (S1). Jalur hardening ada di komentar `04-schema-final.sql`.
- Dead code (A3) belum aku hapus — aman dihapus belakangan, lihat `01-AUDIT-MENYELURUH.md` §5 (kemungkinan ikut bikin Lint FAILED).
