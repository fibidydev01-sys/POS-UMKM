# POS UMKM — Refactor UI/UX (shadcn/ui) · Drop-in `src/`

Paket ini berisi **file baru & file yang diubah** untuk di-_drop_ ke folder `src/`
proyek kamu. Tema **Warung Modern** (terracotta `#c2410c` / teal `#0f766e` / krem
`#faf7f2`) dipertahankan 100%. Fokus refactor: **Kasir responsif (grid/list +
keranjang), toggle yang benar, mobile-portrait-first, halaman tipis →
components/hooks/store**.

> Catatan: file di `src/lib/**` (db, supabase, utils, cart/promo-engine,
> config/features, export/*) **TIDAK** disertakan karena logikanya sehat dan
> tidak diubah. Yang dikirim hanya lapisan UI + state + halaman tipis.

---

## 1) Install dependency baru

Komponen shadcn butuh paket berikut. Jalankan sekali:

```bash
npm install \
  @radix-ui/react-slot \
  @radix-ui/react-dialog \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-switch \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group \
  @radix-ui/react-separator \
  @radix-ui/react-scroll-area \
  @radix-ui/react-select \
  @radix-ui/react-label \
  class-variance-authority \
  vaul \
  sonner \
  recharts \
  zustand
```

`clsx`, `tailwind-merge`, `lucide-react` biasanya sudah ada (kalau belum,
`npm install clsx tailwind-merge lucide-react`).

`globals.css` meng-`@import "tw-animate-css";` untuk animasi
dialog/sheet/drawer. Pasang juga:

```bash
npm install -D tw-animate-css
```

(Atau hapus baris `@import "tw-animate-css";` di `src/app/globals.css` kalau
tidak mau animasi — UI tetap berfungsi, hanya transisi buka/tutup yang hilang.)

---

## 2) Drop file ke `src/`

Salin seluruh isi folder `src/` di ZIP ini menimpa `src/` proyek kamu
(struktur folder sudah sama persis). Ringkasnya:

- `src/components/ui/*` — **BARU**: set primitive shadcn (button, card, switch,
  toggle-group, badge, separator, skeleton, spinner, scroll-area, dialog, sheet,
  drawer, alert-dialog, alert, input, textarea, label, select, empty, sonner,
  sidebar).
- `src/hooks/*` — **BARU**: `use-media-query` (SSR-safe), `use-current-user`
  (identitas terpadu), `use-kasir-data`, `use-dashboard-data`, `use-riwayat`,
  `use-menu-manager`.
- `src/store/cart-store.ts` — **BARU**: state keranjang (Zustand).
- `src/components/shared/*` — **BARU**: `app-shell`, `app-sidebar`, `mobile-nav`,
  `nav-config`, `page-skeleton`, `confirm-dialog`, `alert-backup`.
- `src/components/{kasir,menu,dashboard,riwayat,pengaturan,aktivasi}/*` —
  komponen view + sub-komponen (tiap halaman dipecah).
- `src/app/**/page.tsx` — **DIUBAH**: tiap halaman kini tipis (≈4 baris,
  import 1 View).
- `src/app/layout.tsx` — **DIUBAH**: pakai `AppShell` baru + `<Toaster/>`.
- `src/app/globals.css` — **DIUBAH**: token sama, tambah `--popover` + animasi,
  aturan cetak struk dipertahankan.

---

## 3) PENTING — perhatikan 3 hal ini

1. **`src/components/ui/label.tsx` menimpa milikmu.** Di kode lama, `Textarea`
   diekspor dari `label.tsx`. Versi baru memisah `Textarea` ke
   `components/ui/textarea.tsx`, **tapi** `label.tsx` tetap me-_re-export_
   `Textarea` (`export { Textarea } from "./textarea"`) supaya `import { Label,
   Textarea } from "@/components/ui/label"` lama tetap jalan. Aman.

2. **Pola `Dialog` berubah** ke standar shadcn: sekarang **wajib** pakai
   `<DialogContent>` di dalam `<Dialog>`. Semua komponen di paket ini sudah
   memakai pola baru. Kalau kamu punya file lama lain yang masih memakai pola
   `<Dialog open=…>` tanpa `DialogContent`, sesuaikan ke pola baru.

3. **File `lib/export/excel.ts` & `lib/export/import.ts` TIDAK disertakan.**
   Versi aslimu yang dipakai. `pengaturan-view.tsx` memanggil
   `exportDanDownload(umkmId, config)` dan `importDariFile(umkmId, file)` —
   pastikan signature itu cocok dengan implementasimu (sama seperti versi lama).

---

## 4) Yang diperbaiki (ringkas)

- **BUG-04 (grid kasir mepet/teks kepotong)** → `menu-card` tanpa
  `aspect-square` (tinggi ikut konten, `min-h`), `line-clamp-2`, harga selalu
  tampil; `menu-grid` pakai breakpoint sistem `grid-cols-2 sm:grid-cols-3
  lg:grid-cols-4` (bukan `min-[480px]`/`min-[700px]`).
- **BUG-05 (toggle rusak)** → semua diganti `Switch`/`ToggleGroup` shadcn
  (a11y + animasi benar, tanpa `translate-x-[22px]` manual). Toggle
  ketersediaan menu disable saat request jalan + rollback bila gagal.
- **BUG-01/02 (keranjang flash/remount + 2 renderer kembar)** → **satu**
  `cart-panel` adaptif: `useIsDesktop()` SSR-safe (null sebelum mount → tidak
  ada flash), Drawer (mobile) / Sheet kanan (desktop). Hapus trik
  `[&>button:first-child]:hidden`.
- **BUG-03 (tombol keranjang pakai offset magic-number)** → tombol kini
  `sticky` di dalam konten; sidebar/lebar diatur primitive (CSS var), offset
  konten otomatis via flex.
- **BUG-06 (alert/confirm browser)** → `sonner` toast + `ConfirmDialog`.
- **BUG-07 (loading "Memuat…")** → `PageSkeleton` (varian kasir/dashboard/list/form).
- **BUG-08 (dua jalur identitas)** → `useCurrentUser` terpadu, redirect
  `/aktivasi` terpusat.
- **BUG-09 (halaman gemuk)** → tiap `page.tsx` tipis; logika pindah ke
  `*-view.tsx` + hooks + store.
- **BUG-10 (hex hardcoded di chart)** → `chart-omzet` recharts memakai CSS var
  tema (`var(--primary)`, `var(--border)`).

Flag V1/V2 (`features.payment/refund/promoEngine/promoManagement`) tetap
dihormati di seluruh UI. Aturan cetak thermal 58/80mm (`#area-struk`) tidak
diubah.

---

## 5) Setelah drop

```bash
npm run dev      # cek tampilan
npm run build    # pastikan build bersih
```

Kalau ada error tipe soal `e`/`v` implicit-any, itu karena tsconfig kamu sangat
ketat; semua handler sudah benar secara runtime. Aktifkan inferensi React
(default `@types/react`) atau tambahkan tipe eksplisit sesuai selera.
