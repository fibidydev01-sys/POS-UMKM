# POS UMKM — MVP Web (Next.js 16 + Supabase)

Kasir online sederhana untuk UMKM Indonesia. Versi web untuk **validasi & iterasi cepat** sebelum build versi React Native offline. KISS — tanpa login, tanpa RLS, identitas via **kode aktivasi → cookie `umkm_id`**.

Tema **Warung Modern** (terracotta + teal di atas krem), mobile-first, dengan cetak struk via `window.print()`.

---

## ✨ Fitur

- **Aktivasi** — onboarding 2 langkah (kode → profil usaha). Tanpa password.
- **Kasir** — grid menu, keranjang, qty +/-, diskon transaksi (preset/kustom), cetak struk thermal 58mm.
- **Menu** — CRUD kategori & produk, toggle ketersediaan, filter kategori.
- **Riwayat** — daftar transaksi per tanggal, detail + cetak ulang + hapus.
- **Dashboard** — omzet hari ini / minggu / bulan, grafik 7 hari, produk terlaris, analisa diskon.
- **Pengaturan** — profil usaha, **Export/Import Excel** (backup & restore), info, keluar perangkat.

---

## 🚀 Menjalankan

> Project ini sudah lengkap. Setelah `create-next-app` + `shadcn init` Anda (opsional — komponen UI sudah disertakan), cukup:

```bash
# 1) Salin env, lalu isi kredensial Supabase Anda
cp .env.local.example .env.local

# 2) Install dependencies
pnpm install

# 3) Jalankan
pnpm dev
```

Buka `http://localhost:3000`.

### Setup Supabase

1. Buat project di [supabase.com](https://supabase.com) (free tier cukup).
2. Buka **SQL Editor** → tempel & jalankan seluruh isi [`supabase-schema.sql`](./supabase-schema.sql). Ini membuat semua tabel, index, dan 3 kode test.
3. **Settings → API** → salin `Project URL` dan `anon public key` ke `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Kode aktivasi

Sudah ada 3 kode test dari schema: `UMKM-MAMTA-01`, `UMKM-PILOT-02`, `UMKM-TEST-03`.

Tambah kode baru via SQL Editor:

```sql
INSERT INTO aktivasi_kode (kode) VALUES ('UMKM-WARUNGBU-04');
```

Reset perangkat (agar kode bisa dipakai ulang):

```sql
UPDATE aktivasi_kode SET used=FALSE, umkm_id=NULL, activated_at=NULL
WHERE kode = 'UMKM-MAMTA-01';
```

---

## ☁️ Deploy ke Vercel

1. Push repo ke GitHub.
2. Import di [vercel.com](https://vercel.com).
3. Tambahkan 2 environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Bagikan link + kode aktivasi ke UMKM pilot via WhatsApp.

---

## 🧱 Catatan Teknis

- **Next.js 16** → gating aktivasi pakai **`src/proxy.ts`** (pengganti `middleware.ts`; fungsi diberi nama `proxy`).
- **Tanpa Supabase Auth** → query di-scope manual dengan `.eq('umkm_id', ...)` di setiap pemanggilan. Cookie `umkm_id` sengaja **bukan httpOnly** agar bisa dibaca client untuk scoping (ini penanda tenant, bukan kredensial rahasia). Tambahkan RLS nanti setelah tervalidasi.
- **Komponen UI** di `src/components/ui/` adalah **primitive ringan** (Tailwind + React, tanpa Radix) dengan API ala shadcn — agar `pnpm install` minim dependensi dan ZIP self-contained. Anda bebas menggantinya dengan komponen shadcn resmi (`pnpm dlx shadcn@latest add ...`) kapan saja.
- **Tailwind v4** — konfigurasi berbasis CSS di `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`). Tidak ada `tailwind.config.ts`.
- **Uang = Integer Rupiah** (tanpa desimal). Lihat `src/lib/utils/currency.ts`.
- **Snapshot harga** — `transaction_items` menyimpan nama & harga saat transaksi. Laporan historis **tidak pernah** JOIN ke `menu_item`.
- **Nomor order reset harian** per UMKM. **Zona waktu Asia/Jakarta** di seluruh perhitungan (`src/lib/utils/date.ts`).
- **Cetak struk** — hanya elemen `#area-struk` yang tampil saat print (CSS `@media print` di `globals.css`).
- **Backup Excel** — Sheet `Laporan` (untuk dibaca) + Sheet `BACKUP_DATA` (untuk restore; jangan diedit manual).

---

## 📂 Struktur Singkat

```
src/
├── app/            # Halaman (kasir, menu, riwayat, dashboard, pengaturan, aktivasi) + api/aktivasi
├── components/     # ui/ (primitive), kasir/, menu/, dashboard/, shared/
├── lib/
│   ├── supabase/   # client & server
│   ├── db/         # query: menu, transaksi, config
│   ├── export/     # excel (export) & import
│   └── utils/      # currency, date, umkm-id, cn
└── proxy.ts        # gating aktivasi (Next.js 16)
```

---

*MVP ini alat validasi, bukan produk final. Ship fast, learn real.*
