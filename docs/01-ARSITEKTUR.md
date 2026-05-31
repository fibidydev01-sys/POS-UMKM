# 01 — Arsitektur & Keputusan Desain

---

## Konteks & Scope

**Bisnis:** Coffee shop UMKM — single outlet, single owner yang sekaligus kasir.

**Distribusi:** Kode aktivasi. Owner beli kode → aktivasi → langsung operasi. Tidak ada akun online, tidak ada langganan bulanan.

**Fokus utama:** Akurasi rekap bulanan. Tidak boleh kelewat 1 rupiah pun.

**Yang di luar scope:** Payment gateway, multi-outlet, inventory stok, PPN, loyalty points, integrasi akuntansi.

---

## Root Cause: Kenapa Schema Harus Ketat Sejak V1

Skema awal POS generik hanya menyimpan **hasil akhir angka** — tidak menyimpan **kenapa angka itu bisa segitu.**

| Gap | Masalah | Fix yang diterapkan |
|---|---|---|
| Tidak ada `item_type` | Tidak bisa bedain normal vs diskon vs BOGO | ENUM `item_type_enum` di `transaction_items` |
| `diskon_nominal` + `diskon_persen` keduanya ada | Tidak konsisten, bisa berbeda | Hapus `diskon_nominal` — persen saja |
| Tidak ada sumber diskon | Tidak bisa audit dari mana diskon berasal | FK ke `diskon_preset` wajib di item discounted |
| `nomor_order` tidak unique | Bisa bentrok | `UNIQUE(umkm_id, nomor_order)` + function |
| Tidak ada status transaksi | Void = hard delete, data hilang | ENUM `status` + void/refund flow |
| Tidak ada snapshot harga | Harga berubah, rekap lama tidak valid | Snapshot `harga_satuan` di `transaction_items`, immutable |
| `grand_total` tidak di-enforce | Bisa salah tanpa yang tahu | Trigger `check_grand_total` |
| Tidak ada payment method | Rekonsiliasi kas fisik vs QRIS tidak bisa | ENUM `payment_method_enum` + `uang_diterima` + `kembalian` |
| Rounding tidak didefinisikan | 1 rupiah selisih × 200 transaksi/hari = chaos | Formula eksplisit, ditulis di tiga tempat |
| Hard delete menu item | Data riwayat transaksi rusak | Soft delete: `is_active = FALSE` |

---

## Empat Prinsip Arsitektur

### Prinsip 1 — Tidak Pernah Hard Delete

Semua yang pernah ada di menu tetap ada selamanya. Yang "dihapus" hanya `is_active = FALSE`.

Berlaku untuk: `menu_item`, `diskon_preset`, `promo_rule`.

**Kenapa:** Riwayat transaksi FK ke `menu_item_id`. Kalau item dihapus, riwayat rusak diam-diam.

### Prinsip 2 — Snapshot Adalah Kontrak Permanen

`transaction_items` adalah bukti yang tidak boleh berubah setelah INSERT.

Kolom yang immutable setelah INSERT:
- `nama_produk` — nama saat transaksi terjadi
- `harga_satuan` — harga saat transaksi terjadi  
- `diskon_persen` — persen yang berlaku saat itu
- `item_type` — konteks kenapa harga bisa segitu
- `triggered_by_item_id` — untuk BOGO, item mana yang memicu

**Kenapa:** Harga menu bisa berubah. Laporan bulan lalu harus tetap sama kapanpun dibuka.

### Prinsip 3 — Kontrak yang Tidak Di-enforce di DB Bukan Kontrak

Setiap aturan bisnis kritis punya enforcement di tiga lapis:
1. **Database** (ENUM, CHECK constraint, TRIGGER)
2. **Server logic** (ditulis eksplisit, di-review, bisa di-test)
3. **Known limitation** (yang tidak bisa di-enforce DB, terdokumentasi)

### Prinsip 4 — Transaksi Completed Tidak Boleh Diubah

Satu-satunya pengecualian: void atau refund oleh owner, dengan `void_by`, `void_at`, `void_reason` yang lengkap. Audit trail wajib ada.

---

## Dua Jenis Diskon yang Dipisah

### Jenis 1 — Diskon Persen (Transaction Level)

Contoh: "Member diskon 10%", "Happy Hour 15%"

- Berlaku ke **seluruh transaksi** — semua item eligible kena
- Owner buat preset di `/pengaturan/diskon`
- Kasir pilih dari list preset aktif (atau tidak ada diskon)
- **Tidak ada input angka bebas** — by design, untuk audit trail
- Item `promo_free` **tidak pernah kena** diskon ini

### Jenis 2 — Promo Quantity / BOGO (Item Level)

Contoh: "Beli 1 Gratis 1", "Beli 2 Gratis 1"

- Berlaku per item spesifik yang punya rule BOGO aktif
- Item gratis harganya 0 tapi **wajib tercatat** dengan `item_type = 'promo_free'`
- **Otomatis terpicu** saat item masuk keranjang — kasir tidak perlu tahu
- V1: tidak aktif. V2: aktif lewat `promo-engine.ts`

---

## Skenario Chaos & Fix-nya

### Chaos 1 — BOGO + Diskon Persen Bersamaan
Pelanggan pesan 2 Americano (BOGO aktif), kasir tap diskon 10%.

**Masalah:** Item gratis (harga 0) kena diskon → rekap biaya promo jadi dobel.

**Fix:** Server eksplisit — `item_type = 'promo_free'` tidak pernah kena diskon header. `final_price_item = 0`, `diskon_persen = 0` dipaksa sebelum INSERT. CHECK constraint di DB sebagai lapisan terakhir.

### Chaos 2 — Harga Item Berubah Tengah Bulan
Owner ganti harga Americano dari Rp 25.000 ke Rp 30.000 tanggal 15.

**Masalah:** Rekap bulan ini campuran dua harga tanpa keterangan.

**Fix:** `harga_satuan` di `transaction_items` adalah snapshot — immutable setelah INSERT.

### Chaos 3 — Kasir Salah Pilih Preset Diskon
Harusnya 10%, kasir pilih 25%. Tidak ada jejak.

**Fix:** Simpan `diskon_preset_id` bukan hanya angka persen. Owner bisa trace preset mana yang dipilih.

### Chaos 4 — Item Dihapus dari Menu Setelah Ada Transaksi
Owner hapus Caramel Latte. `menu_item_id` di `transaction_items` jadi FK ke baris yang tidak ada.

**Fix:** Tidak ada hard delete. `is_active = FALSE`. Data tetap ada selamanya.

### Chaos 5 — Grand Total Tidak Cocok
`grand_total` header = Rp 50.000, `SUM(final_price_item)` = Rp 47.000.

**Fix:** Grand total tidak dikirim dari UI. Dihitung ulang server. Trigger `check_grand_total` di DB sebagai lapisan terakhir — kalau tidak cocok, seluruh INSERT di-rollback.

### Chaos 6 — Rounding 1 Rupiah
UI bulatkan ke bawah, server bulatkan ke atas. 1 rupiah per item × 200 transaksi/hari = Rp 6.000/bulan rekap tidak cocok.

**Fix:** Satu formula: `ROUND(harga × qty × (1 - persen/100), 0)`, round half up, kalikan dulu baru bulatkan. Ditulis di tiga tempat: dokumen ini, komentar kode, dan harus ada unit test.

---

## Rantai Kepercayaan Data

Kalau satu mata rantai putus — rekap tidak bisa dipercaya.

```
menu_item.harga
      │
      ▼ (snapshot saat item masuk keranjang)
transaction_items.harga_satuan     ← IMMUTABLE setelah INSERT
      │
      ▼
transaction_items.item_type        ← normal | discounted | promo_free
      │
      ▼
transaction_items.diskon_persen    ← dari preset, BUKAN angka bebas dari UI
transaction_items.diskon_preset_id ← FK referensi ke preset yang dipakai
      │
      ▼
transaction_items.final_price_item ← dihitung server, BUKAN dari UI
      │
      ▼
transaksi.grand_total              ← SUM(final_price_item)
                                     dihitung server
                                     di-enforce TRIGGER di DB
```

---

## Kontrak Data yang Di-enforce

| Kontrak | Di-enforce di |
|---|---|
| Kasir tidak bisa input diskon bebas | UI hanya tampilkan preset; tidak ada field input angka |
| BOGO hanya dipicu dari item yang punya rule | Promo engine pure function; tidak ada aksi manual |
| Grand total dihitung server, bukan dari UI | Server recalculate → Trigger DB validasi |
| Tidak ada hard delete | Semua "hapus" = `is_active = FALSE` |
| Transaksi completed tidak bisa diubah | Hanya void/refund owner, dengan audit trail |
| Semua nilai terbatas pakai ENUM | `item_type`, `status`, `payment_method`, `tipe_promo`, `role` |
| `item_type = 'promo_free'` → `final_price_item = 0` | CHECK constraint `transaction_items` |
| `item_type = 'promo_free'` → `triggered_by_item_id NOT NULL` | CHECK constraint `transaction_items` |
| `item_type = 'discounted'` → `diskon_persen > 0` | CHECK constraint `transaction_items` |
| `triggered_by_item_id` harus dalam transaksi yang sama | Trigger `trg_validate_triggered_by_same_transaction` |
| Cash: `uang_diterima >= grand_total`, `kembalian = uang_diterima - grand_total` | CHECK constraint `transaksi` |
| Void/refund: `void_by`, `void_at`, `void_reason` wajib ada | CHECK constraint `transaksi` |

---

## Model Identitas & Akses

### Tidak Ada Login

Identitas dikontrol via dua cookie yang di-set saat aktivasi kode:

```
Cookie umkm_id  → UUID tenant
                  Dipakai untuk scoping semua query: .eq('umkm_id', umkmId)
                  Lifetime: 5 tahun

Cookie owner_id → UUID dari row users (role='owner')
                  Dipakai sebagai: kasir_id, updated_by, void_by di semua operasi
                  Lifetime: 5 tahun
```

### Satu Owner per UMKM

Setiap UMKM hanya punya satu user — role `owner`. User ini di-seed otomatis saat aktivasi kode. Tidak ada kasir terpisah, tidak ada login screen.

```sql
-- Di-seed saat aktivasi:
INSERT INTO users (umkm_id, username, role, is_active)
VALUES (umkmId, 'owner', 'owner', true);
```

### Isolasi Tenant

RLS disabled. Isolasi dilakukan di application layer — setiap query wajib include:
```typescript
.eq('umkm_id', umkmId)
```

Semua fungsi di `src/lib/db/*.ts` sudah include filter ini. Tidak ada query yang bisa return data lintas tenant secara tak sengaja.

---

## Rekap Pertanyaan yang Harus Bisa Dijawab DB

### Revenue (filter `status = 'completed'`):
- Berapa total omzet hari ini / minggu ini / bulan ini?
- Berapa dari cash vs QRIS vs transfer?
- `SUM(uang_diterima) - SUM(kembalian)` → uang yang harusnya ada di laci?

### Biaya promo:
- Berapa total nilai diskon persen yang diberikan?
- Berapa total nilai BOGO yang direlakan?
- Preset mana yang paling sering dipakai?

### Volume:
- Item mana yang paling banyak terjual?
- Item mana yang paling sering didiskon?

### Audit:
- Transaksi mana yang void atau refund? Siapa yang void, kapan, kenapa?
