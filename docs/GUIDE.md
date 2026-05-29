# POS UMKM — Architecture Alignment Guide
**Tanggal:** 2026-05-29
**Tujuan:** Menyinkronkan codebase dengan schema final Supabase.

---

## Ringkasan Masalah

Schema DB sudah final dan ketat (enums, triggers, RLS, constraints). Codebase **belum mencerminkan schema itu**. Ada 7 kelas masalah yang harus diselesaikan sebelum aplikasi bisa jalan di atas schema final.

---

## 7 Kelas Masalah (Prioritas Tinggi → Rendah)

### 1. KRITIS — Hard delete vs soft delete
**File:** `src/lib/db/menu.ts` → fungsi `hapusMenuItem`
Schema menetapkan `is_active` untuk soft delete. `menu_item` **tidak boleh di-hard delete** karena `transaction_items` punya FK nullable ke sana — jika dihapus paksa, histori transaksi kehilangan referensi.
**Dampak saat ini:** Produk yang sudah pernah dijual bisa dihapus → data riwayat korup.

### 2. KRITIS — RLS tidak diaktifkan di client
**File:** `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
Schema mengaktifkan RLS di semua tabel dan mensyaratkan `SET app.current_umkm_id = '<uuid>'` di setiap koneksi. Tanpa ini, **semua query return kosong** karena policy RLS memblokir akses.
**Dampak saat ini:** Aplikasi tidak bisa membaca/menulis data apapun di schema final.

### 3. KRITIS — Tabel `users` tidak ada di codebase, tapi wajib di schema
**File baru:** `src/lib/db/users.ts`
`menu_item.updated_by`, `diskon_preset.updated_by`, `promo_rule.updated_by`, `transaksi.kasir_id` — semuanya FK ke `users(id)` dan NOT NULL. Tanpa `users` record, semua INSERT ke tabel-tabel ini akan gagal FK constraint.
**Dampak saat ini:** INSERT menu, INSERT transaksi — semua gagal.

### 4. TINGGI — Mismatch kolom `transaksi`
**File:** `src/lib/db/transaksi.ts`
| Codebase (sekarang) | Schema DB | Keterangan |
|---|---|---|
| `nomor_order: number` | `nomor_order: TEXT` | Format `YYYYMMDD-XXXX` |
| `timestamp` | `created_at` | Nama kolom beda |
| `subtotal` | tidak ada | Codebase simpan ke kolom yang tidak exist |
| `diskon_persen` | tidak ada | Idem |
| `diskon_nominal` | tidak ada | Idem |
| `metode_bayar: string` | `payment_method: enum` | Nilai `"tunai"` tidak valid di enum |
| `catatan` | tidak ada | Kolom tidak exist di schema |
| — | `status` | Tidak ada di interface codebase |
| — | `diskon_preset_id` | Tidak ada di interface codebase |
| — | `kasir_id` | Tidak ada di codebase |
| — | `uang_diterima` | Tidak ada di codebase |
| — | `kembalian` | Tidak ada di codebase |

### 5. TINGGI — Mismatch kolom `transaction_items`
**File:** `src/lib/db/transaksi.ts`
| Codebase (sekarang) | Schema DB | Keterangan |
|---|---|---|
| `diskon_nominal` | tidak ada | Kolom computed di client, tidak disimpan |
| `subtotal_item` | tidak ada | Idem |
| — | `item_type` (enum) | Tidak ada di codebase — WAJIB |
| — | `diskon_preset_id` | Tidak ada di codebase |
| — | `triggered_by_item_id` | Tidak ada (untuk promo BOGO) |

### 6. TINGGI — Mismatch kolom `menu_item`
**File:** `src/lib/db/menu.ts`
| Codebase (sekarang) | Schema DB | Keterangan |
|---|---|---|
| `tersedia` | `is_available` | Nama field beda |
| — | `is_active` | Tidak ada di interface MenuItem |
| — | `updated_by` | Wajib (FK users), tidak ada di codebase |

### 7. SEDANG — Fitur belum ada sama sekali
Tiga tabel di schema tidak punya representasi di codebase:
- `diskon_preset` — kasir seharusnya pilih preset, bukan input bebas
- `promo_rule` — logika BOGO/buy2get1 belum ada
- Void/refund flow — `hapusTransaksi` di riwayat langsung hard delete, schema punya `status` enum

---

## Peta File: Edit vs Buat Baru

### FILE YANG HARUS DIEDIT

#### `src/lib/supabase/client.ts`
**Perubahan:** Tambah helper `withRls(umkmId)` — wrapper yang memanggil `SET app.current_umkm_id` sebelum setiap query.
**Kenapa:** RLS aktif di semua tabel, tanpa session variable ini seluruh query return kosong.
**Catatan:** Supabase JS client tidak punya built-in untuk `SET` custom variable — harus pakai `supabase.rpc('set_umkm_id', { id: umkmId })` atau query raw `SELECT set_config(...)`. Perlu stored procedure kecil di Supabase.

#### `src/lib/supabase/server.ts`
**Perubahan:** Sama seperti client — tambah RLS setter untuk Route Handler.

#### `src/lib/db/menu.ts`
**Perubahan:**
1. Rename `tersedia` → `is_available` di interface `MenuItem`
2. Tambah `is_active` ke interface
3. Tambah `updated_by` ke interface dan semua mutasi (insert/update)
4. Ganti `hapusMenuItem` dari `.delete()` menjadi `.update({ is_active: false })`
5. `getMenuItems` — filter `is_active = true` (bukan semua)
6. `getMenuTersedia` — filter `is_active = true AND is_available = true`
7. `tambahMenuItem` & `updateMenuItem` — kirim `updated_by` (kasir_id)
8. `toggleTersedia` — rename param `tersedia` → `isAvailable`, update field `is_available`

#### `src/lib/db/transaksi.ts`
**Perubahan — interface `Transaksi`:**
- Ganti `nomor_order: number` → `nomor_order: string`
- Ganti `timestamp` → `created_at`
- Hapus `subtotal`, `diskon_persen`, `diskon_nominal`, `catatan` (tidak ada di schema)
- Tambah `status: 'completed' | 'void' | 'refund'`
- Tambah `payment_method: 'cash' | 'qris' | 'transfer' | 'debit'`
- Tambah `kasir_id: string`
- Tambah `diskon_preset_id: string | null`
- Tambah `uang_diterima: number | null`
- Tambah `kembalian: number | null`

**Perubahan — interface `TransactionItem`:**
- Hapus `diskon_nominal`, `subtotal_item` (tidak ada di schema)
- Tambah `item_type: 'normal' | 'discounted' | 'promo_free'`
- Tambah `diskon_preset_id: string | null`
- Tambah `triggered_by_item_id: string | null`

**Perubahan — `CartItem`:**
- Tambah `item_type: 'normal' | 'discounted' | 'promo_free'`
- Ganti `diskon_persen: number` → `diskon_persen: number; diskon_preset_id: string | null`
- Tambah `payment_method: 'cash' | 'qris' | 'transfer' | 'debit'`
- Tambah `uang_diterima?: number` (untuk flow cash)

**Perubahan — `simpanTransaksi`:**
- Nomor order: format `YYYYMMDD-XXXX` (bukan increment integer biasa)
- Kirim `payment_method` (bukan `metode_bayar`)
- Kirim `kasir_id`
- Kirim `status: 'completed'`
- Hapus pengiriman `subtotal`, `diskon_persen`, `diskon_nominal`, `catatan`
- Untuk cash: kirim `uang_diterima`, `kembalian`
- `diskon_preset_id` jika ada diskon
- Items: kirim `item_type`, hapus `subtotal_item` dan `diskon_nominal`

**Perubahan — `hapusTransaksi`:**
- Ganti dari hard delete menjadi void: `.update({ status: 'void', void_by, void_at, void_reason })`
- Signature: `voidTransaksi(id, voidBy, voidReason)`

**Perubahan — semua query dashboard:**
- `timestamp` → `created_at`
- Tambah filter `status = 'completed'` ke semua query revenue (void/refund tidak masuk omzet)

**Perubahan — `nomorOrderBerikutnya`:**
- Output berubah: kembalikan `string` format `YYYYMMDD-XXXX`
- Query: cari `nomor_order` yang prefix-nya `YYYYMMDD-` untuk hari ini, ambil suffix max

#### `src/components/kasir/diskon-input.tsx`
**Perubahan:** Sekarang preset hardcoded `[0, 5, 10, 15, 20]`. Seharusnya load dari tabel `diskon_preset` milik UMKM. Input bebas juga harus dihapus — schema melarang diskon nominal bebas.
**Catatan arsitektur:** Ini berarti `DiskonInput` perlu menjadi async component atau parent yang load preset dari DB dan pass ke sini sebagai props.

#### `src/components/kasir/keranjang-panel.tsx`
**Perubahan:**
- Tambah selector `payment_method` (Cash / QRIS / Transfer / Debit)
- Untuk `cash`: tampilkan input `uang_diterima` dan kalkulasi `kembalian` live
- Hapus field `catatan` (tidak ada di schema transaksi)
- `DiskonInput` terima `presets` dari DB, bukan hardcoded

#### `src/app/kasir/page.tsx`
**Perubahan:**
- Load `diskon_preset` dari DB
- Load `kasir_id` (dari `users` table, atau dari context)
- Pass `payment_method` dan `uang_diterima` ke `simpanTransaksi`
- Tangani perubahan signature `simpanTransaksi`

#### `src/app/riwayat/page.tsx`
**Perubahan:**
- Tombol "Hapus" → "Void" (bukan delete, tapi update status)
- Tampilkan badge status (completed / void / refund) per transaksi
- Gunakan `created_at` bukan `timestamp`

#### `src/components/kasir/struk-print.tsx`
**Perubahan:**
- `trx.timestamp` → `trx.created_at`
- `trx.metode_bayar` → `trx.payment_method`
- Tampilkan kembalian jika `payment_method === 'cash'`
- Hapus `trx.catatan` (tidak ada di schema)

#### `src/lib/export/excel.ts`
**Perubahan:**
- Update `BACKUP_HEADERS` sesuai kolom schema aktual
- `timestamp` → `created_at`
- `metode_bayar` → `payment_method`
- Hapus `subtotal`, `diskon_persen`, `diskon_nominal`, `catatan` dari transaksi
- Tambah `status`, `kasir_id` ke export

#### `src/lib/export/import.ts`
**Perubahan:**
- Update mapping kolom sesuai perubahan `BACKUP_HEADERS`
- Saat import, kirim `item_type` (default `'normal'` jika tidak ada)
- Hapus field yang tidak ada di schema

---

### FILE BARU YANG HARUS DIBUAT

#### `src/lib/db/users.ts` ← BARU
**Isi:**
```
Interface User { id, umkm_id, username, role, is_active, created_at, updated_at }
Interface UserInput { username, role }

getUsers(umkmId): User[]
getOrCreateSystemUser(umkmId): User    ← untuk keperluan updated_by saat tidak ada auth
tambahUser(umkmId, input): void
updateUser(id, input): void
hapusUser(id): void                    ← soft: is_active = false
```
**Kenapa:** Semua mutasi menu, diskon preset, promo rule, dan kasir_id di transaksi butuh FK ke `users(id)`.
**Catatan penting:** Karena app ini tidak pakai Supabase Auth, perlu ada satu "system user" per UMKM yang di-seed otomatis saat aktivasi. User ini yang mengisi `updated_by` dan `kasir_id` sampai fitur multi-user diimplementasi.

#### `src/lib/db/diskon-preset.ts` ← BARU
**Isi:**
```
Interface DiskonPreset { id, umkm_id, nama, persen, is_active, updated_by, ... }
Interface DiskonPresetInput { nama, persen }

getDiskonPreset(umkmId): DiskonPreset[]           ← hanya is_active = true
tambahDiskonPreset(umkmId, input, updatedBy): void
updateDiskonPreset(id, input, updatedBy): void
hapusDiskonPreset(id): void                       ← soft: is_active = false
```
**Kenapa:** `DiskonInput` tidak boleh free input. Kasir pilih dari preset yang dibuat owner. Tanpa ini, flow kasir tidak bisa jalan sesuai schema.

#### `src/lib/db/promo-rule.ts` ← BARU
**Isi:**
```
Interface PromoRule { id, umkm_id, menu_item_id, tipe_promo, qty_beli, qty_gratis,
                      is_active, berlaku_mulai, berlaku_sampai, updated_by, ... }

getPromoAktif(umkmId): PromoRule[]   ← is_active=true, berlaku_mulai<=now, berlaku_sampai>now
getPromoUntukItem(menuItemId): PromoRule | null
tambahPromoRule(umkmId, input, updatedBy): void
updatePromoRule(id, input, updatedBy): void
hapusPromoRule(id): void
```
**Kenapa:** BOGO/buy2get1 harus otomatis terpicu saat item masuk keranjang. Tanpa ini, `item_type = 'promo_free'` dan `triggered_by_item_id` tidak pernah terisi.

#### `src/lib/cart/promo-engine.ts` ← BARU
**Isi (pure functions, tidak ada IO):**
```
applyPromo(cartItems: CartItem[], promoRules: PromoRule[]): CartItem[]
```
**Logika:**
- Iterasi cart, cek apakah item punya promo aktif
- Jika BOGO (qty_beli=1, qty_gratis=1): setiap 2 unit → 1 gratis
- Jika buy2get1 (qty_beli=2, qty_gratis=1): setiap 3 unit → 1 gratis
- Item gratis: `item_type = 'promo_free'`, `harga_satuan` = harga asli (untuk laporan), `final_price_item = 0`
- Item gratis punya `triggered_by_item_id` yang menunjuk ke CartItem pemicunya

**Kenapa file terpisah:** Logic ini perlu unit-testable tanpa side effects. Juga dipanggil setiap kali cart berubah (reaktif di UI).

#### `src/app/pengaturan/diskon/page.tsx` ← BARU (atau sub-section di pengaturan)
**Isi:** CRUD UI untuk `diskon_preset`. Owner bisa tambah/edit/hapus preset diskon.
**Komponen baru:** `src/components/pengaturan/form-diskon-preset.tsx`

#### `src/app/pengaturan/promo/page.tsx` ← BARU
**Isi:** CRUD UI untuk `promo_rule`. Owner pilih menu item, tipe promo, periode berlaku.
**Komponen baru:** `src/components/pengaturan/form-promo-rule.tsx`

#### `src/lib/supabase/rls.ts` ← BARU
**Isi:**
```
setUmkmContext(supabaseClient, umkmId): Promise<void>
```
Memanggil `SELECT set_config('app.current_umkm_id', umkmId, true)` via Supabase `rpc` atau raw SQL.
**Kenapa file terpisah:** Agar bisa di-call di client maupun server, dan mudah di-mock saat testing.

---

## Struktur File Final

```
src/
├── app/
│   ├── aktivasi/
│   │   └── page.tsx                  ← EDIT (seed system user saat aktivasi)
│   ├── api/
│   │   └── aktivasi/
│   │       └── route.ts              ← EDIT (buat system user setelah klaim kode)
│   ├── dashboard/
│   │   └── page.tsx                  ← EDIT (timestamp → created_at, filter status=completed)
│   ├── kasir/
│   │   └── page.tsx                  ← EDIT (load diskon_preset, promo_rule, payment_method)
│   ├── menu/
│   │   └── page.tsx                  ← EDIT (soft delete, updated_by)
│   ├── pengaturan/
│   │   ├── page.tsx                  ← EDIT (tambah navigasi ke diskon & promo)
│   │   ├── diskon/
│   │   │   └── page.tsx              ← BARU (CRUD diskon_preset)
│   │   └── promo/
│   │       └── page.tsx              ← BARU (CRUD promo_rule)
│   ├── riwayat/
│   │   └── page.tsx                  ← EDIT (void, status badge, created_at)
│   ├── globals.css                   ← tidak perlu diubah
│   ├── layout.tsx                    ← tidak perlu diubah
│   └── page.tsx                      ← tidak perlu diubah
│
├── components/
│   ├── dashboard/
│   │   ├── chart-omzet.tsx           ← tidak perlu diubah
│   │   ├── stat-card.tsx             ← tidak perlu diubah
│   │   └── top-diskon.tsx            ← tidak perlu diubah
│   ├── kasir/
│   │   ├── diskon-input.tsx          ← EDIT (terima presets[] dari props, hapus free input)
│   │   ├── keranjang-panel.tsx       ← EDIT (payment_method selector, cash flow)
│   │   ├── menu-grid.tsx             ← tidak perlu diubah
│   │   └── struk-print.tsx           ← EDIT (created_at, payment_method, kembalian)
│   ├── menu/
│   │   ├── form-menu-item.tsx        ← tidak perlu diubah (minor: field name mapping)
│   │   ├── kategori-list.tsx         ← tidak perlu diubah
│   │   └── menu-item-card.tsx        ← tidak perlu diubah
│   ├── pengaturan/
│   │   ├── form-diskon-preset.tsx    ← BARU
│   │   └── form-promo-rule.tsx       ← BARU
│   └── shared/
│       ├── alert-backup.tsx          ← tidak perlu diubah
│       ├── bottom-nav.tsx            ← tidak perlu diubah
│       └── empty-state.tsx           ← tidak perlu diubah
│
├── lib/
│   ├── cart/
│   │   └── promo-engine.ts           ← BARU (pure function: applyPromo)
│   ├── db/
│   │   ├── config.ts                 ← tidak perlu diubah
│   │   ├── diskon-preset.ts          ← BARU
│   │   ├── menu.ts                   ← EDIT (is_active, is_available, updated_by, soft delete)
│   │   ├── promo-rule.ts             ← BARU
│   │   ├── transaksi.ts              ← EDIT (besar — interface + logika simpan)
│   │   └── users.ts                  ← BARU
│   ├── export/
│   │   ├── excel.ts                  ← EDIT (kolom sesuai schema)
│   │   └── import.ts                 ← EDIT (kolom sesuai schema)
│   ├── supabase/
│   │   ├── client.ts                 ← EDIT (tambah RLS setter)
│   │   ├── rls.ts                    ← BARU (helper setUmkmContext)
│   │   └── server.ts                 ← EDIT (tambah RLS setter)
│   └── utils/
│       ├── currency.ts               ← tidak perlu diubah
│       ├── date.ts                   ← tidak perlu diubah
│       ├── umkm-id.ts                ← tidak perlu diubah
│       └── utils.ts                  ← tidak perlu diubah
│
└── proxy.ts                          ← tidak perlu diubah
```

---

## Urutan Pengerjaan yang Direkomendasikan

Urutan ini penting — setiap tahap bergantung pada tahap sebelumnya.

### Tahap 1 — Fondasi (tidak bisa lanjut tanpa ini)
1. **Supabase: buat stored procedure** `set_umkm_context(umkm_id uuid)` yang memanggil `set_config('app.current_umkm_id', umkm_id::text, true)`
2. **`src/lib/supabase/rls.ts`** — buat `setUmkmContext`
3. **`src/lib/supabase/client.ts`** & **`server.ts`** — integrasi RLS setter
4. **`src/lib/db/users.ts`** — buat interface + `getOrCreateSystemUser`
5. **`src/app/api/aktivasi/route.ts`** — seed system user saat aktivasi berhasil

### Tahap 2 — Core data layer
6. **`src/lib/db/menu.ts`** — fix semua mismatch (is_active, is_available, soft delete, updated_by)
7. **`src/lib/db/diskon-preset.ts`** — baru
8. **`src/lib/db/promo-rule.ts`** — baru
9. **`src/lib/db/transaksi.ts`** — fix interface + simpanTransaksi + voidTransaksi

### Tahap 3 — Business logic
10. **`src/lib/cart/promo-engine.ts`** — baru (pure function)
11. **`src/lib/export/excel.ts`** & **`import.ts`** — update kolom

### Tahap 4 — UI layer
12. **`src/components/kasir/diskon-input.tsx`** — terima props, hapus free input
13. **`src/components/kasir/keranjang-panel.tsx`** — payment_method, cash flow
14. **`src/components/kasir/struk-print.tsx`** — field names
15. **`src/app/kasir/page.tsx`** — load preset + promo, pass ke components
16. **`src/app/riwayat/page.tsx`** — void flow, status badge
17. **`src/app/dashboard/page.tsx`** — filter completed, created_at

### Tahap 5 — Fitur baru (owner)
18. **`src/components/pengaturan/form-diskon-preset.tsx`** — baru
19. **`src/components/pengaturan/form-promo-rule.tsx`** — baru
20. **`src/app/pengaturan/diskon/page.tsx`** — baru
21. **`src/app/pengaturan/promo/page.tsx`** — baru
22. **`src/app/pengaturan/page.tsx`** — tambah navigasi ke halaman baru

---

## Catatan Arsitektur Khusus

### RLS + Client Supabase
Schema memakai RLS dengan session variable `app.current_umkm_id`. Supabase JS client tidak support custom session variable secara native. Ada dua opsi:

**Opsi A (direkomendasikan):** Buat Supabase Function/RPC `set_umkm_context` yang dipanggil sekali sebelum query batch. Masalah: Supabase pooler reset session antar request — tidak reliable untuk client-side Supabase tanpa auth.

**Opsi B (pragmatis untuk MVP):** Nonaktifkan RLS, pertahankan `.eq('umkm_id', ...)` sebagai isolation. RLS di-enable kembali nanti setelah ada proper auth layer.

**Opsi C (proper):** Gunakan Supabase Auth, buat JWT claim `umkm_id`, RLS pakai `auth.jwt()->'umkm_id'`. Ini butuh refactor besar ke sistem auth.

**Rekomendasi saat ini:** Opsi B untuk MVP — hapus RLS dari schema, gunakan `.eq('umkm_id', ...)` yang sudah ada. Document bahwa ini perlu diupgrade ke Opsi C sebelum production multi-tenant.

### `updated_by` dan `kasir_id` tanpa auth
Tanpa sistem login, setiap UMKM perlu satu "system user" yang di-seed saat aktivasi:
```
INSERT INTO users (umkm_id, username, role) VALUES (umkmId, 'owner', 'owner')
```
UUID dari user ini disimpan di `localStorage` atau cookie, dipakai sebagai `updated_by` dan `kasir_id` di semua mutasi. Ini bukan sistem auth — hanya memenuhi FK constraint.

### `nomor_order` format `YYYYMMDD-XXXX`
Query untuk nomor berikutnya:
```sql
SELECT nomor_order
FROM transaksi
WHERE umkm_id = $1
  AND nomor_order LIKE 'YYYYMMDD-%'
ORDER BY nomor_order DESC
LIMIT 1
```
Extract suffix: `parseInt(nomor_order.split('-')[1]) + 1`, pad ke 4 digit.
Generate: `${tanggalJakartaSekarang}-${String(nextNum).padStart(4, '0')}`

### Trigger `grand_total` di DB
DB punya trigger deferred yang memvalidasi `SUM(final_price_item) == grand_total`. Ini artinya:
- `final_price_item` di setiap item **harus sudah benar** sebelum INSERT
- `grand_total` di header transaksi **harus sama persis** dengan sum items
- Kalkulasi harus di server/API layer, bukan di UI
- Jika ada rounding error sekecil apapun, seluruh batch INSERT akan di-rollback

Formula wajib: `ROUND(harga_satuan * qty * (1 - diskon_persen/100), 0)` — kalikan dulu, baru bulatkan.

### Promo engine dan `triggered_by_item_id`
Saat BOGO: user beli 2 unit Item A, cart harus berisi:
```
[
  { menu_item_id: 'A', qty: 1, item_type: 'normal', final_price_item: harga },
  { menu_item_id: 'A', qty: 1, item_type: 'promo_free', final_price_item: 0,
    triggered_by_item_id: <id dari baris pertama> }
]
```
Karena `triggered_by_item_id` FK ke `transaction_items(id)`, ID ini baru ada setelah INSERT baris pertama. Artinya **INSERT harus sequential, bukan batch**, atau pakai approach dua-pass: INSERT semua dulu, lalu UPDATE `triggered_by_item_id` untuk item gratis.

---

## Yang Tidak Perlu Diubah

- `src/lib/utils/` — semua utility murni, tidak ada coupling ke schema
- `src/components/shared/` — UI murni, tidak ada coupling ke DB
- `src/components/dashboard/` — hanya terima props, tidak query DB langsung
- `src/components/menu/` — minor field name mapping, tapi logic tidak berubah
- `src/app/globals.css` — tidak terkait schema
- `src/app/layout.tsx` — tidak terkait schema
- `src/proxy.ts` — tidak terkait schema