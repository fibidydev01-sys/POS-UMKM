# 05 — Cara Deploy & Apply

---

## Prerequisites

| Item | Requirement |
|---|---|
| Node.js | 18+ |
| Package manager | npm / pnpm |
| Supabase project | Aktif, dengan PostgreSQL |
| Environment variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## Setup Fresh (Database Baru)

### Step 1 — Jalankan Schema

1. Buka **Supabase Dashboard → SQL Editor**
2. Paste isi `schema.sql`
3. Klik **Run**
4. Aman dirun ulang — semua pakai `IF NOT EXISTS` / `OR REPLACE`

**Verifikasi:**
```sql
-- Harus 9 baris
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'aktivasi_kode','umkm_config','users','kategori',
    'menu_item','diskon_preset','promo_rule',
    'transaksi','transaction_items'
  );

-- Harus 2 triggers
SELECT count(*) FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Harus 3 functions
SELECT count(*) FROM information_schema.routines
WHERE routine_schema = 'public';
```

### Step 2 — Setup Environment Variables

Buat file `.env.local` di root project:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Feature flag
NEXT_PUBLIC_POS_VERSION=v1
```

**Keterangan:**
- `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY`: untuk client-side queries
- `SUPABASE_SERVICE_ROLE_KEY`: khusus untuk `/api/aktivasi/route.ts` (server-side, bisa bypass RLS kalau RLS aktif)
- `NEXT_PUBLIC_POS_VERSION`: `v1` atau `v2` — mengontrol feature experience

### Step 3 — Install & Run

```bash
npm install
npm run dev    # development
npm run build  # production build
npm start      # production server
```

---

## Apply ke Project yang Sudah Ada

### Kalau Schema Belum Dijalankan

Jalankan `schema.sql` di Supabase SQL Editor (lihat Setup Fresh di atas).

### Kalau Schema Sudah Ada (Patch FIX-01 dan FIX-02)

Jalankan `migration.sql` di Supabase SQL Editor:

```sql
-- migration.sql menangani:
-- FIX-01: BOGO constraint (qty_gratis <= qty_beli, bukan <)
-- FIX-02: discounted item tidak wajib diskon_preset_id
```

Migration aman dijalankan berulang kali — ada DO $$ block dengan cek apakah constraint sudah difix.

### Copy Source Files

Dari bundle `pos-umkm-v2-final.zip`, copy semua file di folder `src/` ke project:

```
src/lib/config/features.ts           ← BARU, wajib ada
src/lib/db/transaksi.ts              ← REPLACE (hasDiskon fix)
src/app/kasir/page.tsx               ← REPLACE (conditional promo load)
src/app/riwayat/page.tsx             ← REPLACE (conditional refund)
src/app/pengaturan/page.tsx          ← REPLACE (conditional promo card)
src/components/kasir/diskon-input.tsx    ← REPLACE (simplified, DB only)
src/components/kasir/keranjang-panel.tsx ← REPLACE (2 vs 4 payment)
```

**File lain dari codebase Final (doc 4, 43 file) sudah benar dan tidak perlu diubah.** Yang di atas adalah file yang punya perubahan spesifik dari bundle kita.

---

## Konfigurasi ENV

### V1 Experience (default, early launch)

```bash
NEXT_PUBLIC_POS_VERSION=v1
```

**Apa yang aktif:**
- Cash + QRIS
- Preset diskon dari DB (management page visible)
- Void transaksi
- Dashboard, Export/Import, semua fitur dasar

**Apa yang tidak aktif:**
- Transfer + Debit (tidak ada di keranjang)
- Refund (tombol tidak muncul)
- BOGO engine (promo_rule tidak di-load)
- Card "Program Promo" di pengaturan

### V2 Experience

```bash
NEXT_PUBLIC_POS_VERSION=v2
```

**Tambahan dari V1:**
- Transfer + Debit di keranjang
- Tombol Refund di riwayat
- BOGO / Buy2Get1 engine aktif
- Card "Program Promo" di pengaturan

---

## Kode Aktivasi

### Kode Testing (sudah ada di seed schema)

| Kode | version_access | Keterangan |
|---|---|---|
| `UMKM-MAMTA-01` | v1 | Testing V1 |
| `UMKM-PILOT-02` | v1 | Testing V1 |
| `UMKM-TEST-03` | v1 | Testing V1 |
| `UMKM-DEV-04` | v1 | Development |
| `UMKM-V2-01` | v2 | Testing V2 |
| `UMKM-V2-02` | v2 | Testing V2 |
| `UMKM-V2-TEST` | v2 | Development V2 |

### Generate Kode Baru untuk Production

```sql
-- Di Supabase SQL Editor
INSERT INTO aktivasi_kode (kode, version_access)
VALUES
  ('UMKM-KOPI-01', 'v1'),
  ('UMKM-KOPI-02', 'v1')
ON CONFLICT (kode) DO NOTHING;
```

**Format kode:** Bebas, asal unik. Konvensi yang dipakai: `UMKM-[NAMA/ID]-[NOMOR]`.

### Proses Aktivasi (apa yang terjadi di server)

Saat owner input kode di halaman aktivasi dan tekan "Aktivasi":

```
POST /api/aktivasi { kode: "UMKM-XXXX-01" }

Server:
  1. Cari kode di aktivasi_kode
  2. Kalau sudah dipakai + umkm_id ada: re-aktivasi, kembalikan umkm_id + owner_id
  3. Kalau belum dipakai:
     a. Generate umkm_id = crypto.randomUUID()
     b. UPDATE aktivasi_kode: used=true, umkm_id=..., activated_at=now()
     c. INSERT umkm_config (profil kosong, app_version dari version_access)
     d. INSERT users (username='owner', role='owner', is_active=true)
     e. INSERT 4 preset diskon default (5%, 10%, 15%, 20%)
     f. Set cookie umkm_id + owner_id (5 tahun)
  4. Return { ok: true, umkmId, ownerId }

Client:
  5. Step 2: isi profil (nama usaha, alamat, telp, footer struk)
  6. Redirect ke /kasir
```

**Re-aktivasi device yang sama:** Kode yang sama bisa dipakai ulang (misal HP baru atau re-install). Server kembalikan `umkm_id` yang sama.

---

## Prosedur Flip V1 → V2

### Kapan Siap Flip?

Flip ke V2 ketika:
- Owner sudah familiar dengan V1 (void, preset diskon, export)
- Owner butuh promo BOGO, atau butuh Transfer/Debit, atau butuh Refund
- Tidak perlu ada kondisi timing khusus — schema tidak berubah

### Cara Flip

**Di hosting (Vercel, Netlify, Railway, dll):**
```
Environment Variables → NEXT_PUBLIC_POS_VERSION → ubah v1 ke v2 → Redeploy
```

**Di .env.local (development):**
```bash
# Ubah baris ini:
NEXT_PUBLIC_POS_VERSION=v1
# Jadi:
NEXT_PUBLIC_POS_VERSION=v2
# Restart dev server
```

**Efek setelah flip:**
- Semua user (yang sudah aktivasi kode lama) langsung dapat V2 experience
- Data transaksi lama tidak terpengaruh
- Tidak ada migrasi DB
- Tidak ada downtime (kalau rolling deploy)

### Apakah Bisa Flip Balik ke V1?

Ya. Ubah ENV ke `v1`, redeploy. Data V2 (refund, BOGO, transfer/debit) tetap ada di DB tapi UI tidak menampilkan fitur-fitur tersebut.

---

## File SQL yang Tersedia

| File | Dipakai untuk |
|---|---|
| `schema.sql` | Fresh install — database baru |
| `migration.sql` | Patch schema yang sudah ada (FIX-01 + FIX-02) |

---

## Cara Apply ke Supabase

### Via SQL Editor (manual)

1. Buka [app.supabase.com](https://app.supabase.com)
2. Pilih project
3. Klik **SQL Editor** di sidebar
4. Paste konten file SQL
5. Klik **Run**

### Via Supabase CLI (opsional)

```bash
supabase db push --file schema.sql
```

---

## Checklist Deploy Production

```
Schema:
  ☐ schema.sql berhasil dirun di Supabase
  ☐ 9 tabel verified
  ☐ 2 triggers verified
  ☐ 3 functions verified
  ☐ RLS semua OFF (verify via pg_tables.rowsecurity)

Environment:
  ☐ NEXT_PUBLIC_SUPABASE_URL set
  ☐ NEXT_PUBLIC_SUPABASE_ANON_KEY set
  ☐ SUPABASE_SERVICE_ROLE_KEY set (server-side only)
  ☐ NEXT_PUBLIC_POS_VERSION set (v1 untuk launch awal)

Fungsional:
  ☐ Aktivasi kode berhasil
  ☐ Profil tersimpan
  ☐ Tambah menu berhasil
  ☐ Transaksi cash tersimpan (grand_total trigger tidak reject)
  ☐ Nomor order format YYYYMMDD-XXXX
  ☐ Void transaksi berhasil
  ☐ Export Excel bisa didownload
  ☐ Import restore dari file yang di-export
```
