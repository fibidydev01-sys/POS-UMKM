# POS UMKM — Arsitektur & Dokumentasi Teknis
> Coffee Shop · Single Outlet · Prototype → Production-Ready
> **Last updated:** 2026-05-29 · Status: V1 ✅ Done · V2 ✅ Done

---

## Daftar Isi

1. [Konteks & Scope](#1-konteks--scope)
2. [Root Cause: Gap Skema Awal](#2-root-cause-gap-skema-awal)
3. [Filosofi Arsitektur](#3-filosofi-arsitektur)
4. [Dua Jenis Diskon yang Dipisah](#4-dua-jenis-diskon-yang-dipisah)
5. [Skenario Chaos & Fix-nya](#5-skenario-chaos--fix-nya)
6. [Role Separation: Owner vs Kasir](#6-role-separation-owner-vs-kasir)
7. [Rantai Kepercayaan Data](#7-rantai-kepercayaan-data)
8. [Kontrak Data yang Di-enforce](#8-kontrak-data-yang-di-enforce)
9. [Schema Database Final](#9-schema-database-final)
10. [Logika Server: Kalkulasi Transaksi](#10-logika-server-kalkulasi-transaksi)
11. [Formula BOGO](#11-formula-bogo)
12. [Flow Kasir: Dari Input sampai Struk](#12-flow-kasir-dari-input-sampai-struk)
13. [Struk: Kontrak Data ke Pelanggan](#13-struk-kontrak-data-ke-pelanggan)
14. [Known Limitations](#14-known-limitations)
15. [Rekap Pertanyaan yang Harus Bisa Dijawab DB](#15-rekap-pertanyaan-yang-harus-bisa-dijawab-db)
16. [V1 — Owner-Only POS](#16-v1--owner-only-pos)
17. [V2 — Multi-User + Fitur Lanjutan](#17-v2--multi-user--fitur-lanjutan)
18. [Cara Apply ke Codebase](#18-cara-apply-ke-codebase)
19. [Utang Teknis Terdokumentasi](#19-utang-teknis-terdokumentasi)

---

## 1. Konteks & Scope

**Bisnis:** Coffee shop UMKM — single outlet, single kasir operasional.

**Produk:** Aplikasi POS (Point of Sale) didistribusikan lewat kode aktivasi. Owner aktivasi kode → dapat akses → langsung bisa operasi.

**Scope yang disepakati:**
- Single kasir di V1, multi-kasir di V2
- Single UMKM per instalasi — multi-tenant via `umkm_id` ada di schema tapi bukan fokus operasional
- Fokus utama: **akurasi rekap bulanan — tidak boleh kelewat sepeserpun, bahkan 1 rupiah**
- Payment gateway (Midtrans, dll) tidak masuk scope — UMKM tidak sampai ke sana

---

## 2. Root Cause: Gap Skema Awal

Skema awal hanya menyimpan **hasil akhir angka** — tidak menyimpan **kenapa angka itu bisa segitu.**

### Gap yang ditemukan dan sudah di-fix:

| Gap | Masalah | Fix |
|---|---|---|
| Tidak ada `item_type` | Tidak bisa bedain normal vs diskon vs BOGO | ENUM `item_type_enum` di `transaction_items` |
| Dua kolom diskon ambigu | `diskon_persen` DAN `diskon_nominal` tidak konsisten | Hapus `diskon_nominal` — persen saja |
| Diskon dua level tidak terhubung | Header vs item level tidak ada logika | `diskon_preset_id` di header + propagasi eksplisit ke item |
| Tidak ada sumber diskon | Tidak bisa audit dari mana diskon berasal | FK ke `diskon_preset` wajib ada |
| `nomor_order` tidak unique | Bisa bentrok concurrent | `UNIQUE(umkm_id, nomor_order)` + function `generate_nomor_order()` |
| Tidak ada status transaksi | Void = hard delete, data hilang | ENUM `transaksi_status_enum` + void flow |
| Tidak ada history harga | Harga item berubah, rekap lama tidak bisa verifikasi | Snapshot `harga_satuan` di `transaction_items`, immutable |
| `grand_total` tidak di-enforce | Bisa salah tanpa yang tahu | Trigger `check_grand_total` di database |
| Tidak ada payment method | Rekonsiliasi kas fisik vs QRIS tidak bisa | ENUM `payment_method_enum` + `uang_diterima` + `kembalian` |
| Rounding tidak didefinisikan | 1 rupiah selisih × 200 transaksi/hari = chaos | `ROUND(harga * qty * (1 - persen/100), 0)`, round half up, kalikan dulu |
| `umkm_id` lintas tabel tidak konsisten | Kasir UMKM A bisa pakai preset UMKM B | RLS di V2, `.eq('umkm_id', ...)` di V1 |
| Hard delete menu item | Data riwayat transaksi rusak | Soft delete: `is_active = FALSE` |

---

## 3. Filosofi Arsitektur

### Prinsip 1 — Jangan pernah hard delete

Semua yang pernah ada di menu tetap ada selamanya. Yang "dihapus" hanya `is_active = FALSE`.

Berlaku untuk: `menu_item`, `diskon_preset`, `promo_rule`.

### Prinsip 2 — Snapshot adalah kontrak

`transaction_items` adalah bukti permanen yang tidak boleh berubah setelah INSERT.

Kolom snapshot yang immutable:
- `nama_produk` — nama saat transaksi terjadi
- `harga_satuan` — harga saat transaksi terjadi
- `diskon_persen` — persen yang berlaku saat itu
- `item_type` — konteks kenapa harga bisa segitu
- `triggered_by_item_id` — untuk BOGO, item mana yang memicu

### Prinsip 3 — Kontrak yang tidak di-enforce di database bukan kontrak

Setiap aturan bisnis kritis punya enforcement di tiga lapis:
1. Database (ENUM, CHECK constraint, TRIGGER)
2. Server logic eksplisit (ditulis, di-review, di-test)
3. Known limitation terdokumentasi (yang tidak bisa di-enforce DB)

### Prinsip 4 — Transaksi completed tidak boleh diubah

Satu-satunya pengecualian: void atau refund oleh owner, dengan `void_by`, `void_at`, `void_reason` yang lengkap.

---

## 4. Dua Jenis Diskon yang Dipisah

### Jenis 1 — Diskon Persen (Transaction Level)

- Contoh: "Member diskon 10%", "Happy Hour 15%"
- Berlaku ke **seluruh transaksi** — semua item yang eligible kena
- Kasir pilih dari `diskon_preset` yang `is_active = TRUE`
- Item `promo_free` **tidak kena** diskon ini

### Jenis 2 — Promo Quantity / BOGO (Item Level)

- Contoh: "Beli 1 Gratis 1", "Beli 2 Gratis 1"
- Berlaku per item spesifik yang punya rule BOGO
- Item gratis harganya 0 tapi **wajib tercatat** dengan `item_type = 'promo_free'`
- **Otomatis terpicu** saat item masuk keranjang — kasir tidak perlu tahu
- V1: tidak aktif. V2: aktif lewat `promo-engine.ts`

---

## 5. Skenario Chaos & Fix-nya

### Chaos 1 — BOGO + Diskon Persen Bersamaan
Pelanggan pesan 2 Americano (BOGO), kasir tap diskon 10%.

**Masalah:** Item gratis kena diskon dari harga 0 → rekap dobel biaya promo.

**Fix:** Logika server eksplisit — `item_type = 'promo_free'` tidak pernah kena diskon header. `final_price_item = 0`, `diskon_persen = 0` dipaksa di server sebelum INSERT.

---

### Chaos 2 — Harga Item Berubah Tengah Bulan
Owner ganti harga Americano dari Rp 25.000 ke Rp 30.000 tanggal 15.

**Masalah:** Rekap BOGO bulan ini: campuran dua harga tanpa keterangan.

**Fix:** `harga_satuan` di `transaction_items` adalah snapshot saat transaksi — immutable setelah INSERT.

---

### Chaos 3 — Kasir Salah Pilih Preset Diskon
Harusnya 10%, kasir pilih 25%. Tidak ada jejak.

**Fix:** Simpan `diskon_preset_id` bukan hanya angka persen. Owner bisa trace preset mana yang dipilih.

---

### Chaos 4 — Item Dihapus dari Menu Setelah BOGO
Owner hard-delete Caramel Latte. `menu_item_id` di `transaction_items` → NULL.

**Fix:** Tidak ada hard delete. `is_active = FALSE`. Data tetap ada.

---

### Chaos 5 — Grand Total Tidak Cocok
`grand_total` header = Rp 50.000, `SUM(final_price_item)` = Rp 47.000. Kas fisik tidak cocok.

**Fix:** Grand total tidak dikirim dari UI. Dihitung server. Trigger `check_grand_total` sebagai lapisan terakhir.

---

### Chaos 6 — BOGO Tidak Ada Jejak Pemicu
2 Americano + 2 Latte, keduanya BOGO. Mana item gratis dari Americano, mana dari Latte?

**Fix:** `triggered_by_item_id` — UUID yang menunjuk ke item yang memicunya dalam transaksi yang sama.

---

### Chaos 7 — Rounding 1 Rupiah
UI bulatkan ke bawah, server bulatkan ke atas. 1 rupiah per item × 200 transaksi/hari = Rp 6.000/bulan tidak cocok dengan kas.

**Fix:** Satu aturan rounding: `ROUND(harga * qty * (1 - persen/100), 0)`, round half up, kalikan dulu baru bulatkan. Ditulis di tiga tempat: dokumen ini, komentar kode, unit test.

---

## 6. Role Separation: Owner vs Kasir

Ini bukan soal keamanan saja — ini soal **integritas data.**

### Owner — akses penuh ke konfigurasi:
- Kelola menu: tambah, edit, nonaktifkan (soft delete)
- Set dan ubah harga item
- Buat dan kelola `diskon_preset`
- Buat dan kelola `promo_rule` (BOGO, Buy2Get1)
- Lihat semua rekap: harian, mingguan, bulanan
- Void dan refund transaksi (dengan alasan)
- Kelola akun kasir (V2)
- **Tidak bisa input transaksi**

### Kasir — akses terbatas:
- Input transaksi: pilih item dari menu `is_active = TRUE` dan `is_available = TRUE`
- Pilih diskon dari `diskon_preset` yang `is_active = TRUE`
- BOGO otomatis terpicu — kasir tidak perlu tahu
- Toggle `is_available` item kalau stok habis hari itu
- Lihat riwayat transaksi (read-only di V2)
- **Tidak bisa lihat rekap/dashboard**
- **Tidak bisa ubah harga**
- **Tidak bisa buat/edit preset diskon**
- **Tidak bisa input nominal diskon bebas**
- **Tidak bisa void/refund transaksi**

---

## 7. Rantai Kepercayaan Data

Alur yang tidak boleh putus satu pun:

```
menu_item.harga
      ↓ (saat item masuk keranjang — snapshot)
transaction_items.harga_satuan      ← immutable setelah INSERT
      ↓
transaction_items.item_type         ← normal / discounted / promo_free
      ↓
transaction_items.diskon_persen     ← dari preset (bukan angka bebas)
transaction_items.diskon_preset_id  ← referensi ke preset yang dipakai
      ↓
transaction_items.final_price_item  ← dihitung server, bukan dari UI
      ↓
transaksi.grand_total               ← HARUS == SUM(final_price_item)
                                       dihitung server, di-enforce TRIGGER
```

**Kalau satu mata rantai putus — rekap tidak bisa dipercaya.**

---

## 8. Kontrak Data yang Di-enforce

| Kontrak | Enforcement |
|---|---|
| Kasir tidak bisa input diskon bebas | UI hanya tampilkan preset; tidak ada field input angka |
| BOGO hanya dipicu dari item yang punya rule | Promo engine pure function; kasir tidak ada aksi manual |
| Grand total dihitung server, bukan dari UI | Server recalculate; Trigger DB sebagai lapisan terakhir |
| Tidak ada hard delete | Semua "hapus" di UI = `is_active = FALSE` |
| Transaksi completed tidak bisa diubah | Hanya void/refund oleh owner, dengan audit trail lengkap |
| Semua nilai terbatas pakai ENUM | `item_type`, `status`, `payment_method`, `tipe_promo`, `role` |
| `item_type = 'promo_free'` → `final_price_item = 0` | CHECK constraint di `transaction_items` |
| `item_type = 'promo_free'` → `triggered_by_item_id` tidak NULL | CHECK constraint di `transaction_items` |
| `item_type = 'discounted'` → `diskon_preset_id` tidak NULL | CHECK constraint di `transaction_items` |
| `triggered_by_item_id` harus dalam transaksi yang sama | Trigger `trg_validate_triggered_by_same_transaction` |
| Cash: `uang_diterima >= grand_total` dan `kembalian = uang_diterima - grand_total` | CHECK constraint di `transaksi` |
| Void: `void_by`, `void_at`, `void_reason` wajib ada | CHECK constraint di `transaksi` |

---

## 9. Schema Database Final

### ENUM Types

```sql
item_type_enum        ('normal', 'discounted', 'promo_free')
transaksi_status_enum ('completed', 'void', 'refund')
tipe_promo_enum       ('bogo', 'buy2get1')
payment_method_enum   ('cash', 'qris', 'transfer', 'debit')
role_enum             ('owner', 'kasir', 'system')
```

### Tabel & Kolom Kunci

**`aktivasi_kode`** — kode distribusi produk
- `kode` TEXT UNIQUE NOT NULL
- `used` BOOLEAN, `umkm_id` UUID, `activated_at` TIMESTAMPTZ

**`umkm_config`** — profil UMKM
- `umkm_id` UUID UNIQUE, `nama_umkm`, `alamat`, `no_telp`, `footer_struk`, `app_version`

**`users`** — akun pengguna
- `umkm_id`, `username`, `role` (role_enum), `is_active`
- V2: `auth_id` UUID (link ke Supabase Auth)
- UNIQUE(umkm_id, username)

**`kategori`** — kategori menu
- `umkm_id`, `nama`, `urutan`, `is_active`

**`menu_item`** — tulang punggung sistem
- `umkm_id`, `kategori_id` FK, `nama`, `harga` NUMERIC(12,2)
- `is_active` BOOLEAN — owner control, soft delete permanen
- `is_available` BOOLEAN — kasir toggle harian
- `updated_by` UUID FK ke users
- CHECK: `harga >= 0`, `nama <> ''`

**`diskon_preset`** — preset diskon yang bisa dipilih kasir
- `umkm_id`, `nama`, `persen` NUMERIC(5,2) ← support 12.5%
- `is_active`, `updated_by` FK ke users
- CHECK: `persen > 0 AND persen < 100`

**`promo_rule`** — rule BOGO/buy2get1
- `umkm_id`, `menu_item_id` FK, `tipe_promo` (tipe_promo_enum)
- `qty_beli` INTEGER, `qty_gratis` INTEGER
- `is_active`, `berlaku_mulai`, `berlaku_sampai` (nullable = tidak ada batas)
- `updated_by` FK ke users
- CHECK: `qty_beli > 0`, `qty_gratis > 0`, `qty_gratis < qty_beli`
- CHECK: `berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai`
- UNIQUE(umkm_id, menu_item_id, tipe_promo)

**`transaksi`** — header transaksi
- `umkm_id`, `nomor_order` TEXT (format: YYYYMMDD-XXXX)
- `status` (transaksi_status_enum), DEFAULT 'completed'
- `diskon_preset_id` FK nullable, `payment_method` (payment_method_enum)
- `grand_total` NUMERIC(12,2)
- `uang_diterima` NUMERIC nullable — hanya cash
- `kembalian` NUMERIC nullable — hanya cash
- `kasir_id` FK ke users NOT NULL
- `void_by` FK nullable, `void_at` TIMESTAMPTZ nullable, `void_reason` TEXT nullable
- CHECK: grand_total >= 0
- CHECK: cash constraint (uang_diterima >= grand_total, kembalian exact)
- CHECK: void trail konsisten (completed → void info NULL; void/refund → void info NOT NULL)
- UNIQUE(umkm_id, nomor_order)

**`transaction_items`** — baris per item, snapshot permanen
- `transaksi_id` FK, `menu_item_id` FK nullable, `umkm_id`
- `nama_produk` TEXT — snapshot
- `harga_satuan` NUMERIC(12,2) — snapshot
- `qty` INTEGER, `item_type` (item_type_enum)
- `diskon_persen` NUMERIC(5,2) DEFAULT 0
- `diskon_preset_id` FK nullable
- `triggered_by_item_id` FK self-referential nullable
- `final_price_item` NUMERIC(12,2)
- CHECK: harga_satuan >= 0, qty > 0, final_price_item >= 0
- CHECK: item 'normal' → diskon_persen = 0, diskon_preset_id NULL, triggered_by NULL
- CHECK: item 'promo_free' → final_price_item = 0, diskon_persen = 0, triggered_by NOT NULL
- CHECK: item 'discounted' → diskon_persen > 0, diskon_preset_id NOT NULL

### Triggers

**`trg_validate_grand_total`** (DEFERRED, AFTER INSERT on transaction_items)
```
SUM(final_price_item) harus == grand_total di header transaksi
Kalau tidak cocok → RAISE EXCEPTION → seluruh batch di-rollback
```

**`trg_validate_triggered_by_same_transaction`** (BEFORE INSERT on transaction_items)
```
triggered_by_item_id harus ada di transaction_items dengan transaksi_id yang sama
V1: selalu NULL → trigger langsung return NEW tanpa cek
V2: aktif saat promo engine isi triggered_by_item_id
```

### Helper Function

**`generate_nomor_order(p_umkm_id UUID) → TEXT`**
```
Format: YYYYMMDD-XXXX (zona Jakarta)
SELECT MAX + 1 per hari per UMKM
KL-03: aman untuk single kasir, harus diganti di V2 multi-kasir
```

### RLS

**V1:** Disabled. Isolasi via `.eq('umkm_id', ...)` di setiap query.

**V2:** Enabled. Policy berbasis JWT claim:
```sql
USING ((auth.jwt() -> 'user_metadata' ->> 'umkm_id')::UUID = umkm_id)
```
Semua tabel: `users`, `kategori`, `menu_item`, `diskon_preset`, `promo_rule`, `transaksi`, `transaction_items`, `umkm_config`, `aktivasi_kode`.

---

## 10. Logika Server: Kalkulasi Transaksi

**Harus ditulis eksplisit di server. Tidak boleh diasumsikan developer tahu.**

```
SEBELUM INSERT ke database:

1. Untuk setiap item di keranjang:

   JIKA item_type = 'promo_free':
     final_price_item = 0
     diskon_persen    = 0
     diskon_preset_id = NULL
     → diskon header TIDAK masuk ke item ini

   JIKA item_type = 'normal' DAN ada diskon header:
     item_type        = 'discounted'
     diskon_persen    = preset.persen
     diskon_preset_id = preset.id
     final_price_item = ROUND(harga_satuan × qty × (1 − persen/100), 0)

   JIKA item_type = 'normal' DAN tidak ada diskon header:
     diskon_persen    = 0
     diskon_preset_id = NULL
     final_price_item = harga_satuan × qty

2. grand_total = SUM(semua final_price_item)

3. Kalau payment_method = 'cash':
   kembalian = uang_diterima − grand_total
   (uang_diterima harus >= grand_total — di-guard sebelum submit)

4. INSERT transaksi header dengan grand_total hasil kalkulasi server

5. INSERT transaction_items:
   - V1: batch INSERT (triggered_by_item_id selalu NULL)
   - V2 dengan promo: INSERT sequential karena triggered_by_item_id
     butuh UUID dari baris yang di-INSERT sebelumnya

6. Trigger check_grand_total di DB validasi sebagai lapisan terakhir

7. Kalau ada yang tidak cocok → ROLLBACK seluruh transaksi
   Rollback: void header (bukan hard delete)
```

---

## 11. Formula BOGO

**Satu versi. Tidak boleh berubah. Ditulis di tiga tempat: dokumen ini, komentar kode, unit test.**

```
qty_gratis_total = FLOOR(qty_dipesan / (qty_beli + qty_gratis)) × qty_gratis
qty_bayar        = qty_dipesan − qty_gratis_total
```

### Contoh BOGO (qty_beli=1, qty_gratis=1):

| Pesan | Gratis | Bayar |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 1 | 1 |
| 3 | 1 | 2 |
| 4 | 2 | 2 |

### Contoh Buy2Get1 (qty_beli=2, qty_gratis=1):

| Pesan | Gratis | Bayar |
|---|---|---|
| 2 | 0 | 2 |
| 3 | 1 | 2 |
| 4 | 1 | 3 |
| 6 | 2 | 4 |

### Struktur baris di `transaction_items` untuk BOGO qty > 1:

Setiap pasangan punya link tersendiri. Contoh 4 Americano BOGO:

```
Baris 1: item_type = normal,      triggered_by_item_id = NULL
Baris 2: item_type = promo_free,  triggered_by_item_id = UUID baris 1
Baris 3: item_type = normal,      triggered_by_item_id = NULL
Baris 4: item_type = promo_free,  triggered_by_item_id = UUID baris 3
```

Bukan semua baris gratis pointing ke baris 1.

---

## 12. Flow Kasir: Dari Input sampai Struk

### Step 1 — Login
- **V1:** Tidak ada login. Cookie `umkm_id` sebagai identitas tenant.
- **V2:** Login username + PIN 6 digit. Session Supabase Auth persist. Langsung ke POS screen setelah login.

### Step 2 — Input pesanan
- Kasir tap item dari grid menu
- Hanya tampil item `is_active = TRUE` dan `is_available = TRUE`
- **V2:** Sistem cek `promo_rule` aktif di background — item gratis otomatis masuk keranjang dengan label "GRATIS (BOGO)". Kasir tidak perlu tahu.

### Step 3 — Pilih diskon (opsional)
- Kasir tap tombol diskon → muncul list `diskon_preset` yang `is_active = TRUE`
- Pilih satu atau tidak ada
- **Tidak ada field input angka bebas**

### Step 4 — Review order
- List item normal dengan harga
- List item kena diskon dengan harga setelah diskon
- List item gratis dengan label "GRATIS (BOGO)"
- Total yang harus dibayar

### Step 5 — Pilih metode bayar
- **V1:** Cash / QRIS
- **V2:** Cash / QRIS / Transfer / Debit

### Step 6 — Proses pembayaran
- **Cash:** kasir input uang diterima → sistem hitung kembalian real-time
- **QRIS/Transfer/Debit:** konfirmasi manual kasir bahwa sudah terbayar

### Step 7 — Submit ke server
1. Validasi semua item masih `is_active = TRUE`
2. Hitung ulang qty gratis BOGO (V2)
3. Terapkan logika diskon per item (promo_free tidak kena diskon header)
4. Hitung ulang semua `final_price_item` — tidak percaya data dari UI
5. Hitung ulang `grand_total` = SUM semua `final_price_item`
6. Generate `nomor_order` format YYYYMMDD-XXXX via DB function
7. INSERT transaksi header
8. INSERT transaction_items (sequential untuk V2 promo)
9. Trigger DB validasi `grand_total`
10. Kalau ada yang tidak cocok → ROLLBACK, kasir dapat notif error

### Step 8 — Struk
- Tampil di layar setelah transaksi berhasil
- Print ke printer thermal / share WhatsApp / skip

### Step 9 — Reset
- Layar kembali ke grid menu kosong
- Siap order berikutnya

### Void Flow (V1 + V2)
- **V1:** Owner void via halaman riwayat. Konfirmasi → `status = 'void'`, `void_by`, `void_at`, `void_reason` tersimpan.
- **V2:** Tambah Refund — untuk kasus pembeli sudah bayar, minta uang kembali. Status = 'refund', semantik berbeda dari void.
- Kasir tidak bisa void atau refund — hanya owner.

---

## 13. Struk: Kontrak Data ke Pelanggan

Struk adalah satu-satunya dokumen yang pelanggan pegang. Ini bukan preferensi UI — ini arsitektur data.

```
[NAMA UMKM]
[Alamat]
================================
No: 20250529-0042
Tgl: 29 Mei 2025, 14:32

Americano         1x  Rp 25.000
Americano         1x  GRATIS (BOGO)
Latte             2x  Rp 32.000
  Diskon Happy Hour 10%  -Rp 3.200
--------------------------------
Subtotal              Rp 53.800
--------------------------------
TOTAL                 Rp 53.800

Bayar (Tunai)         Rp 60.000
Kembalian             Rp  6.200
================================
Terima kasih!
[Footer UMKM]
```

**Yang wajib ada:**
- `nomor_order`
- Tanggal dan jam transaksi (zona Jakarta)
- List item: nama, qty, harga satuan
- Item gratis dari promo: nama, qty, **"GRATIS (BOGO)"** — bukan "Rp 0" tanpa keterangan
- Diskon header kalau ada: nama preset, persentase, nominal dihemat
- `grand_total`
- `payment_method`
- Kalau cash: `uang_diterima` dan `kembalian`
- Kalau void: label "*** VOID ***"

---

## 14. Known Limitations

**Ini bukan bug yang tidak disadari. Ini lubang yang disadari, terdokumentasi, dan diserahkan ke application layer secara eksplisit.**

### KL-01: Overlap promo aktif untuk item yang sama
`UNIQUE(umkm_id, menu_item_id, tipe_promo)` mencegah tipe yang sama, tapi tidak mencegah overlap waktu.

**Enforcement:** Application layer — sebelum INSERT `promo_rule` baru, query cek apakah ada rule aktif yang periode waktunya overlap untuk item yang sama.

---

### KL-02: `is_available` tidak ada auto-reset harian
Kasir set `is_available = FALSE` karena stok habis. Tidak ada mekanisme otomatis reset ke TRUE besok.

**Trade-off:** Kasir toggle manual. Kalau lupa, item tidak muncul berhari-hari tanpa ada yang sadar.

**Solusi V2+:** Scheduled job reset harian, atau opsi per item "reset otomatis setiap hari".

---

### KL-03: `generate_nomor_order` tidak atomic untuk multi-kasir
SELECT MAX+1 aman untuk single kasir karena tidak ada concurrent INSERT.

**JANGAN SKIP INI KALAU ADA KASIR KEDUA.** Harus diganti ke PostgreSQL sequence atau `SELECT FOR UPDATE` di row counter terpisah.

---

### KL-04: RLS disabled di V1
Isolasi tenant via `.eq('umkm_id', ...)` di setiap query. Kalau satu query lupa filter → data UMKM lain bisa bocor.

**Mitigation V1:** Semua query DB di codebase wajib include `.eq('umkm_id', ...)`.

**Fix:** V2 mengaktifkan RLS proper dengan Supabase Auth JWT.

---

### KL-05: `triggered_by_item_id` dijaga trigger, bukan FK constraint
Trigger `trg_validate_triggered_by_same_transaction` menjaga integritas ini. Tapi operasi bulk yang bypass trigger bisa melanggar integritas.

**Mitigation:** Semua operasi lewat API layer yang normal — tidak ada akses langsung ke DB selain lewat aplikasi.

---

### KL-06 (V2): `get_umkm_id_from_jwt()` return NULL kalau JWT tidak ada claim
Terjadi kalau ada user Supabase Auth yang dibuat tanpa set `user_metadata`.

**Fix:** Pastikan setiap `createUser` di Supabase Auth selalu include `user_metadata: { umkm_id, username, role }`.

---

### KL-07 (V2): `is_owner()` dan `get_current_user_id()` gagal kalau `auth_id` belum diisi
Data lama dari V1 tidak punya `auth_id` di tabel `users`.

**Fix:** Jalankan migration data — isi `auth_id` untuk semua user yang ada sebelum V2 live.

---

### KL-08 (V2): `aktivasi_kode` INSERT hanya dari service role
Client tidak bisa INSERT kode baru. By design — admin harus tambah kode via Supabase Dashboard atau API admin.

---

## 15. Rekap Pertanyaan yang Harus Bisa Dijawab DB

Semua pertanyaan ini bisa dijawab dari database tanpa tebak-tebakan.

### Revenue (filter `status = 'completed'`):
- Berapa total uang masuk kas hari ini / minggu ini / bulan ini?
- Berapa dari transaksi cash vs QRIS vs transfer?
- Berapa `SUM(uang_diterima) - SUM(kembalian)` → uang yang harusnya ada di laci?

### Biaya promo:
- Berapa total nilai diskon persen yang diberikan? (`SUM(harga × qty × diskon_persen / 100)` per item 'discounted')
- Berapa total nilai BOGO yang diberikan? (`SUM(harga_satuan)` per item 'promo_free')
- Preset diskon mana yang paling sering dipakai?

### Volume:
- Item mana yang paling banyak terjual? (termasuk item gratis dihitung)
- Item mana yang paling sering didiskon?
- Item mana yang paling banyak keluar lewat BOGO?

### Audit:
- Transaksi mana yang void atau refund? Siapa yang void, kapan, kenapa?
- **V2:** Kasir mana yang paling banyak memberikan diskon?
- **V2:** Omzet per kasir per hari/bulan?

---

## 16. V1 — Owner-Only POS

**Status: ✅ Selesai**

**Definisi:** Satu UMKM, satu perangkat, satu orang (owner = kasir). Tidak ada login, tidak ada role separation.

### Keputusan teknis V1:

| Aspek | Keputusan |
|---|---|
| Auth | Tidak ada. Cookie `umkm_id` sebagai identitas tenant |
| RLS | Disabled. Isolasi via `.eq('umkm_id', ...)` |
| Kasir ID | System user di-seed saat aktivasi, UUID disimpan di cookie `owner_id` |
| Diskon | Preset default 5%, 10%, 15%, 20% di-seed saat aktivasi |
| Promo | Tidak ada (schema ready, engine belum aktif) |
| Payment | Cash + QRIS |
| Koreksi | Void saja (tidak ada refund) |
| `item_type` yang dipakai | `normal` + `discounted` saja |

### File yang ada di `pos-umkm-src-v1.zip`:

```
BARU (tidak ada sebelumnya):
├── src/lib/db/users.ts
├── src/lib/db/diskon-preset.ts
├── src/app/pengaturan/diskon/page.tsx
└── src/components/pengaturan/form-diskon-preset.tsx

REPLACE (timpa yang lama):
├── src/app/api/aktivasi/route.ts    → seed system user + preset saat aktivasi
├── src/app/kasir/page.tsx           → load preset, payment method, uang_diterima
├── src/app/riwayat/page.tsx         → void (bukan hapus), status badge, created_at
├── src/app/dashboard/page.tsx       → filter status=completed
├── src/app/pengaturan/page.tsx      → link ke halaman diskon
├── src/app/menu/page.tsx            → soft delete, updated_by, is_available
├── src/components/kasir/diskon-input.tsx    → load dari DB, hapus free input
├── src/components/kasir/keranjang-panel.tsx → payment method, cash flow, hapus catatan
├── src/components/kasir/struk-print.tsx     → created_at, payment_method, kembalian
├── src/components/menu/form-menu-item.tsx   → is_available bukan tersedia
├── src/components/menu/menu-item-card.tsx   → is_available bukan tersedia
├── src/components/dashboard/top-diskon.tsx  → AnalisaDiskon interface baru
├── src/lib/db/menu.ts               → is_active, is_available, soft delete, updated_by
├── src/lib/db/transaksi.ts          → interface total rewrite, status, payment_method
├── src/lib/export/excel.ts          → BACKUP_HEADERS sesuai schema
├── src/lib/export/import.ts         → kolom sesuai schema, item_type
└── src/lib/utils/umkm-id.ts         → tambah getOwnerId()
```

### V1 selesai ketika:
- Owner bisa tambah menu, set harga, toggle ketersediaan
- Owner bisa terima bayaran (cash dengan kembalian, QRIS tanpa kembalian)
- Nomor order keluar format YYYYMMDD-XXXX
- Owner bisa void transaksi yang salah
- Riwayat menampilkan status (completed/void) dengan benar
- Dashboard omzet hanya hitung transaksi `completed`
- Export/import Excel bisa download dan restore
- Tidak ada data korup akibat hard delete atau kolom tidak match schema

---

## 17. V2 — Multi-User + Fitur Lanjutan

**Status: ✅ Selesai**

**Definisi:** Owner bisa tambah akun kasir. Setiap kasir login dengan username + PIN. RLS aktif. Promo BOGO otomatis.

### Perbandingan V1 vs V2:

| Aspek | V1 | V2 |
|---|---|---|
| User model | 1 user per UMKM (owner = kasir) | Multi-user, role owner vs kasir |
| Auth | Tidak ada login. Cookie `umkm_id` | Login username + PIN/password |
| RLS | Disabled. `.eq('umkm_id',...)` | Enabled. JWT claim `umkm_id` |
| Kasir ID | System user, tidak bermakna | User yang sedang login, bermakna |
| Diskon | Preset (seed default + CRUD) | Sama |
| Promo | Tidak ada | BOGO + Buy2Get1 otomatis |
| Payment | Cash + QRIS | + Transfer + Debit |
| Koreksi | Void saja | Void + Refund |
| Laporan | Per UMKM | + Per kasir |
| `item_type` | `normal` + `discounted` | + `promo_free` |
| Export/Import | Ada | Ada (tidak berubah) |
| Bottom nav | 5 tab semua orang | Owner: 5 tab. Kasir: 3 tab |

### File yang ada di `pos-umkm-src-v2.zip`:

```
BARU (tidak ada di V1):
├── src/app/login/page.tsx
├── src/app/api/auth/login/route.ts
├── src/app/api/auth/logout/route.ts
├── src/app/api/users/tambah/route.ts
├── src/app/api/users/reset-pin/route.ts
├── src/app/pengaturan/users/page.tsx
├── src/app/pengaturan/promo/page.tsx
├── src/components/pengaturan/user-list.tsx
├── src/components/pengaturan/form-user.tsx
├── src/components/pengaturan/form-promo-rule.tsx
├── src/lib/supabase/auth.ts
├── src/lib/cart/promo-engine.ts
└── src/lib/db/promo-rule.ts

REPLACE (timpa V1):
├── src/proxy.ts                          → role-based routing, Supabase session
├── src/lib/supabase/client.ts           → @supabase/ssr, persistSession
├── src/lib/supabase/server.ts           → createServerClient dengan cookie handler
├── src/lib/db/users.ts                  → full CRUD, auth_id, getCurrentUser
├── src/lib/db/transaksi.ts              → promo_free, refund, laporan per kasir
├── src/app/api/aktivasi/route.ts        → buat Supabase Auth account saat aktivasi
├── src/app/kasir/page.tsx               → auth session, promo engine, 4 payment
├── src/app/riwayat/page.tsx             → void + refund, role-based buttons
├── src/app/dashboard/page.tsx           → filter per kasir, card refund
├── src/app/pengaturan/page.tsx          → auth logout, link kasir + promo
├── src/components/kasir/keranjang-panel.tsx → 4 payment, tampil GRATIS (BOGO)
└── src/components/shared/bottom-nav.tsx → tab berbeda owner vs kasir
```

### Prerequisite V2 sebelum deploy:
1. Jalankan `pos_umkm_schema_v2_migration.sql` di Supabase
2. Install dependency: `npm install @supabase/ssr`
3. Pastikan semua user lama punya `auth_id` terisi (migration data)
4. Test RLS dengan dua akun UMKM berbeda di dua browser

---

## 18. Cara Apply ke Codebase

### Apply V1

1. Run schema: paste `pos_umkm_schema_v1.sql` di Supabase SQL Editor → Run
2. Verifikasi 9 tabel, 2 trigger, 3 function terbuat
3. Extract `pos-umkm-src-v1.zip`
4. Copy isi folder `pos-umkm-src/` ke `d:\BOILERPLATE\pos-umkm-mvp\src\` (merge/replace)
5. File yang tidak ada di ZIP tidak disentuh (tetap dari boilerplate)

### Apply V2 (di atas V1 yang sudah jalan)

1. Install: `npm install @supabase/ssr`
2. Run migration: paste `pos_umkm_schema_v2_migration.sql` di Supabase SQL Editor → Run
3. Verifikasi RLS aktif di semua tabel, policy ada, function baru ada
4. Extract `pos-umkm-src-v2.zip`
5. Copy isi folder `pos-umkm-v2/` ke `d:\BOILERPLATE\pos-umkm-mvp\src\` (merge/replace)
6. Test: login owner, tambah kasir, BOGO, 4 payment method

### File SQL yang tersedia:
- `pos_umkm_schema_v1.sql` — schema fresh (database baru)
- `pos_umkm_schema_v2_migration.sql` — migration V1 → V2 (database yang sudah ada data)

---

## 19. Utang Teknis Terdokumentasi

Ini adalah daftar hal yang disadari tapi belum diselesaikan. Setiap item harus dikerjakan sebelum naik ke tahap berikutnya.

### Sebelum go-live V1:
- [ ] Unit test untuk formula rounding (KL rounding 1 rupiah)
- [ ] Unit test untuk formula BOGO dengan berbagai qty
- [ ] Test: grand_total trigger memang menolak INSERT yang salah
- [ ] Test: soft delete tidak merusak riwayat transaksi lama

### Sebelum V2 bisa multi-kasir:
- [ ] KL-03: Ganti `generate_nomor_order` ke sequence/FOR UPDATE

### Sebelum scale multi-tenant production:
- [ ] KL-04: RLS di V2 harus verified benar-benar isolasi (test dua UMKM berbeda)
- [ ] KL-06: Pastikan semua `createUser` di Supabase Auth include `user_metadata`
- [ ] KL-07: Migration data lama — isi `auth_id` untuk semua user V1

### Nice to have (tidak blocking):
- [ ] KL-02: Auto-reset `is_available` ke TRUE setiap hari (scheduled function)
- [ ] KL-01: Validasi overlap promo di UI sebelum submit (sekarang hanya di application layer, belum ada feedback ke owner)
- [ ] Acceptance test checklist V2 (dari Implementation Phases doc)

---

> **Catatan Akhir**
>
> Rekapan seakurat data yang masuk.
> Schema adalah pagar. Server adalah pengemudi. Keduanya harus benar.
>
> Setiap lubang yang masih ada sudah terdokumentasi sebagai known limitation —
> bukan lubang yang tidak disadari.
>
> **Tidak boleh kelewat sepeserpun. Bahkan 1 rupiah itu penting.**