# POS UMKM — Patch UI Putaran 2 (List/Grid + Drawer everywhere)

Patch ini **menimpa** sebagian file dari paket sebelumnya. Drop isi `src/` di
ZIP ini ke proyek (timpa yang lama). 12 file: 3 baru, 9 diubah.

## 0) HAPUS dulu file mati (sisa versi lama)

```bash
rm src/components/kasir/keranjang-panel.tsx
rm src/components/kasir/diskon-input.tsx
rm src/components/shared/empty-state.tsx
rm src/components/ui/table.tsx
```

Sudah dipastikan tidak ada file lain yang meng-import-nya (selain saling-impor
antar mereka sendiri).

## 1) FILE BARU (3)

- `src/components/shared/form-drawer.tsx` — shell SERAGAM semua form
  Tambah/Edit. Drawer bawah, tinggi seragam (`max-h-[88dvh]`), **tanpa X &
  tanpa Batal**, hanya tombol **Simpan rata kanan**. Punya slot `headerRight`
  untuk badge ala Instagram.
- `src/components/menu/category-badge.tsx` — pil kategori ala IG yang
  menggantikan tombol X di header form menu. Tap → drawer pilih kategori.
- `src/components/kasir/layout-toggle.tsx` — tombol ganti tampilan List/Grid.

## 2) FILE DIUBAH (9)

Kasir:
- `kasir/menu-card.tsx` — dukung **2 layout** (list & grid). Belum ditekan →
  **nama + harga saja**; setelah ditekan → muncul **Badge qty**.
- `kasir/menu-grid.tsx` — render list (1 kolom) atau grid (2/3/4 kolom).
- `kasir/kasir-view.tsx` — **default List**, toggle List/Grid di header (tidak
  dipersist, reset tiap buka). Tombol keranjang sekarang **FAB bulat** di
  posisi **persis sama** dengan FAB "Tambah" di Menu (`bottom-[72px] right-4
  md:bottom-6`) — bar full-width yang naik ketinggian sudah dibuang.
- `kasir/struk-dialog.tsx` — struk sukses kini **Drawer** (bukan Dialog).

Menu:
- `menu/form-menu-item.tsx` — pakai `FormDrawer`. Kategori jadi **badge IG** di
  header. Hapus = tombol teks di dalam body (footer khusus Simpan).
- `menu/menu-view.tsx` — "Kelola Kategori" jadi **Drawer**. (Hapus item tetap
  pakai ConfirmDialog.)

Pengaturan:
- `pengaturan/form-diskon-preset.tsx` — `FormDrawer`.
- `pengaturan/form-promo-rule.tsx` — `FormDrawer`.

Riwayat:
- `riwayat/transaksi-detail.tsx` — detail/struk jadi **Drawer**; void/refund
  confirm tetap ConfirmDialog (alert).

## 3) Aturan UX yang sekarang berlaku

- **Semua Tambah/Edit = Drawer** (tinggi seragam). **Dialog hanya** untuk
  konfirmasi **Hapus / alert** (lewat `ConfirmDialog`).
- Form drawer: tidak ada X, tidak ada Batal — tutup via swipe-down / tap
  overlay. **Simpan** satu-satunya, rata kanan.
- Card item kasir (List & Grid): nama + harga sampai ditekan, lalu badge qty.
- Mobile & tablet: Drawer di-center & dibatasi lebar (`sm:max-w-*`) — match.

## 4) Tidak ada dependency baru

Semua komponen pakai paket yang sudah dipasang di patch sebelumnya (vaul,
radix, dll). Tinggal `npm run dev` / `npm run build`.

> Catatan typecheck: kalau tsconfig kamu ketat dan muncul implicit-any pada
> parameter handler, itu hanya inferensi React — sudah benar saat runtime
> dengan `@types/react`. Build Next.js normal tidak akan terganggu.
