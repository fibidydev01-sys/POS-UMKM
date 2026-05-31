# REKAP COVERAGE AUDIT
> Analisis jujur: apa yang sudah cover, apa yang gap, apa blind spot-nya.
> Semua temuan dikonfirmasi langsung dari kode — bukan asumsi.
> **Last audit:** 2026-05-29 · Schema v3.1 · Codebase pos-umkm-v2-final

---

## Ringkasan Eksekutif

Dari **10 pertanyaan rekap kritis** yang dijanjikan bisa dijawab DB:

| Status | Jumlah | Keterangan |
|---|---|---|
| ✅ Covered penuh | 5 | Data ada, query ada, UI tampilkan |
| 🔶 Partial | 3 | Data ada, query ada, tapi ada nuance/caveat |
| 🔴 Blind spot | 3 | Data ada di DB, tapi tidak ada query/UI yang surfacekan |

**Kabar baik:** Akurasi grand_total dan revenue sudah sangat solid. Tidak ada rupiah yang bisa "bocor" tanpa terdeteksi.

**Kabar yang perlu diperhatikan:** Ada 3 pertanyaan yang dijanjikan bisa dijawab tapi belum bisa dijawab tanpa export Excel ke luar app. Dan ada satu edge case rounding yang potensial 1 rupiah discrepancy antara preview UI dan nilai yang di-charge.

---

## Bagian 1: Yang Sudah Covered ✅

### C-01: Revenue Bulanan / Mingguan / Harian Akurat

**Query:** `getRingkasanOmzet()` — filter `status = 'completed'`

**Konfirmasi:**
```typescript
// transaksi.ts
.select("created_at, grand_total, status")
.eq("umkm_id", umkmId)
// Loop: isCompleted = row.status === "completed"
// Void dan refund tidak pernah masuk r.omzetHariIni
```

**Enforcement berlapis:**
1. Server menghitung `grand_total` — tidak dari UI
2. Trigger `check_grand_total`: `SUM(final_price_item) == grand_total` → rollback kalau tidak cocok
3. Query filter `status = 'completed'`

**Status:** ✅ Akurat. Tidak mungkin ada rupiah dari void/refund yang ikut terhitung.

---

### C-02: Void & Refund Tidak Masuk Revenue

**Konfirmasi:**
- `getRingkasanOmzet`: filter `isCompleted = row.status === "completed"` ✅
- `getOmzet7Hari`: `.eq("status", "completed")` ✅
- `getTopProduk`: `.eq("transaksi.status", "completed")` ✅
- `getAnalisaDiskon`: `.eq("transaksi.status", "completed")` ✅
- Refund punya card tersendiri: `refundBulan` dari `status === "refund"` ✅

**Status:** ✅ Tidak ada celah. Semua agregasi revenue sudah filter completed-only.

---

### C-03: Snapshot Harga Menjaga Akurasi Rekap Historis

**Konfirmasi:**
```sql
transaction_items.nama_produk  -- snapshot nama saat transaksi
transaction_items.harga_satuan -- snapshot harga saat transaksi
transaction_items.final_price_item -- snapshot hasil kalkulasi saat itu
```

Semua immutable setelah INSERT. Owner bisa ganti harga menu kapanpun — rekap bulan lalu tidak berubah.

**Status:** ✅ Data historis aman selamanya.

---

### C-04: Item Terlaris (Top Produk)

**Query:** `getTopProduk()` — `total_terjual` + `total_omzet`

**Konfirmasi:**
```typescript
cur.total_terjual += row.qty;            // item gratis BOGO juga dihitung di volume
cur.total_omzet += row.final_price_item; // item gratis = 0, tidak masuk omzet
```

Ini adalah keputusan desain yang benar: volume BOGO masuk hitungan terjual (betul — produk memang "terjual/keluar") tapi tidak masuk omzet (betul — tidak ada uang masuk untuk item gratis).

**Status:** ✅ Akurat. Volume dan omzet dipisah dengan benar.

---

### C-05: Void/Refund Bisa Ditelusuri

**Data yang tersimpan:**
```
transaksi.status       = 'void' atau 'refund'
transaksi.void_by      = owner UUID
transaksi.void_at      = timestamp
transaksi.void_reason  = alasan (wajib untuk refund)
```

**Di UI:** Halaman riwayat menampilkan badge status, dan kalau ada `void_reason`, ditampilkan di detail transaksi.

**Status:** ✅ Bisa ditelusuri dari UI dan dari DB.

---

## Bagian 2: Yang Ada Tapi Ada Caveat 🔶

### P-01: Analisa Diskon — Menghitung ITEM ROWS, bukan TRANSAKSI

**Yang tersedia:** `getAnalisaDiskon()` — preset mana yang paling sering dipakai + total nilai

**Caveat:**
```typescript
// Untuk setiap baris di transaction_items yang item_type='discounted':
cur.kali_dipakai++;  // ini naik 1 per item row, bukan per transaksi
```

**Implikasi:**
- Transaksi dengan 5 item, semua kena preset 10% → `kali_dipakai` naik 5
- Transaksi dengan 1 item kena preset 10% → `kali_dipakai` naik 1

Owner tidak bisa tahu "preset ini dipakai di 20 transaksi" vs "preset ini dipakai 20 kali tapi mungkin hanya 5 transaksi berbeda."

**Untuk analisa harian UMKM kecil, ini masih practical.** Tapi untuk laporan audit yang lebih presisi, ini perlu diperjelas.

**Cara fix:** Groupkan by `transaksi_id` dulu, baru count distinct. Atau tambah field `jumlah_transaksi` yang berbeda dari `kali_dipakai`.

**Status:** 🔶 Angka ada tapi semantiknya "per item row", bukan "per transaksi". Tidak salah — hanya perlu dipahami.

---

### P-02: Analisa BOGO di Top Produk — Volume Tercampur

**Yang tersedia:** `getTopProduk()` menampilkan total_terjual yang include BOGO free items.

**Caveat:** Owner tidak bisa tahu dari UI:
- "Americano terjual 100 unit" → berapa yang bayar vs berapa yang gratis?
- Berapa revenue yang hilang karena BOGO untuk item ini?

**Data ada di DB:**
```sql
-- Volume yang bayar
SUM(qty) WHERE nama_produk = 'Americano' AND item_type IN ('normal', 'discounted')

-- Volume gratis BOGO
SUM(qty) WHERE nama_produk = 'Americano' AND item_type = 'promo_free'

-- Nilai BOGO yang direlakan untuk item ini
SUM(harga_satuan × qty) WHERE nama_produk = 'Americano' AND item_type = 'promo_free'
```

Tapi tidak ada UI yang menyajikan ini. Top produk hanya tampil total gabungan.

**Status:** 🔶 Data ada, query bisa dibuat, tapi UI tidak memisahkan.

---

### P-03: Struk — Diskon dan BOGO Tercampur di Baris yang Sama

**Bagaimana struk menghitung:**
```typescript
// struk-print.tsx
const subtotalSebelumDiskon = items.reduce(
  (s, it) => s + it.harga_satuan * it.qty, 0
);
const totalDiskon = subtotalSebelumDiskon - trx.grand_total;
const diskonPersen = items.find(it => it.item_type === "discounted")?.diskon_persen ?? 0;
```

**Masalah:** `subtotalSebelumDiskon` mengikutkan harga_satuan dari item `promo_free`, sehingga `totalDiskon` menggabungkan:
- Nilai BOGO (harga item gratis)
- Nilai diskon persen (dari preset)

**Contoh konkret:**
```
Transaksi: 2 Americano Rp 25.000 (BOGO aktif) + diskon header 10%

Di struk akan tampil:
  Subtotal:        Rp 50.000   ← include harga item gratis
  Diskon 10%:      -Rp 27.500  ← BOGO Rp 25.000 + diskon 10% Rp 2.500 DICAMPUR
  TOTAL:           Rp 22.500   ← grand_total BENAR ✅

Padahal seharusnya lebih jelas:
  Americano:       Rp 25.000
  Americano BOGO:  GRATIS
  Diskon 10%:      -Rp 2.500
  TOTAL:           Rp 22.500
```

**Grand total tetap benar** — ini hanya masalah display/transparansi ke pelanggan. Tetapi untuk struk yang dipegang pelanggan, ini bisa membingungkan.

**Status:** 🔶 Angka akhir benar, tapi breakdown diskon di struk tidak transparan untuk kasus BOGO + diskon header bersamaan.

---

## Bagian 3: Blind Spots — Ada di DB, Tidak Ada di UI 🔴

### B-01: Breakdown Omzet per Metode Bayar

**Yang dijanjikan di arsitektur:**
> "Berapa dari transaksi cash vs QRIS vs transfer?"

**Yang ada di DB:**
```sql
SELECT
  payment_method,
  COUNT(*) as jumlah_transaksi,
  SUM(grand_total) as total_omzet
FROM transaksi
WHERE umkm_id = ? AND status = 'completed'
  AND DATE(created_at) = TODAY
GROUP BY payment_method;
```

**Yang ada di dashboard:** Tidak ada. `getRingkasanOmzet` hanya select `created_at, grand_total, status` — payment_method tidak di-fetch sama sekali.

**Dampak praktis:** Owner tidak bisa tahu dari app "hari ini berapa yang masuk cash, berapa QRIS" tanpa export Excel.

**Status:** 🔴 Data ada di DB. Query bisa ditulis. Tapi tidak ada di dashboard atau halaman manapun.

---

### B-02: Rekonsiliasi Kas Fisik

**Yang dijanjikan di arsitektur:**
> "SUM(uang_diterima) - SUM(kembalian) → uang yang harusnya ada di laci"

**Yang ada di DB:**
```sql
SELECT
  SUM(uang_diterima) - SUM(kembalian) as ekspektasi_kas_laci
FROM transaksi
WHERE umkm_id = ?
  AND status = 'completed'
  AND payment_method = 'cash'
  AND DATE(created_at) = TODAY;
```

**Yang ada di dashboard:** Tidak ada. `uang_diterima` dan `kembalian` disimpan ke DB dengan benar (CHECK constraint sudah menjaga konsistensinya), tapi tidak pernah di-surface ke UI.

**Dampak praktis:** Jika owner ingin mencocokkan "uang di laci = Rp X" dengan sistem, tidak bisa tanpa export Excel.

**Ini adalah salah satu janji terpenting dari rekap tapi belum diimplementasikan.**

**Status:** 🔴 Data ada di DB, CHECK constraint sudah jaga konsistensi, tapi query/UI belum ada.

---

### B-03: Nilai Total BOGO yang Direlakan

**Yang dijanjikan di arsitektur:**
> "Berapa total nilai BOGO yang diberikan?"

**Yang ada di DB:**
```sql
-- Nilai BOGO bulan ini
SELECT SUM(harga_satuan * qty) as nilai_bogo_direlakan
FROM transaction_items ti
JOIN transaksi t ON ti.transaksi_id = t.id
WHERE ti.umkm_id = ?
  AND ti.item_type = 'promo_free'
  AND t.status = 'completed'
  AND DATE_TRUNC('month', t.created_at) = DATE_TRUNC('month', NOW());
```

**Yang ada di dashboard:** Tidak ada. `getTopProduk` menghitung volume termasuk promo_free, tapi tidak ada metric "total nilai BOGO direlakan."

**Docs (doc 7) menyebutkan ini sebagai feature V2:**
> "Card nilai promo BOGO bulan ini di dashboard" ← belum diimplementasikan

**Status:** 🔴 Data ada di DB. Query bisa ditulis. Tapi card BOGO di dashboard belum ada.

---

## Bagian 4: Formula Rounding — Ada Dua Formula, Bisa Beda 1 Rupiah

**Ini adalah risiko paling subtle tapi nyata.**

### Formula A — UI Preview (`hitungGrandTotal` di `promo-engine.ts`)
```typescript
const subtotal = cart.reduce((s, c) => {
  if (c.item_type === "promo_free") return s;
  return s + c.harga_satuan * c.qty;  // ← tidak ada rounding per item
}, 0);

const diskonNominal = Math.round(subtotal * diskonPersen / 100);  // ← round sekali di total
const grandTotal = subtotal - diskonNominal;
```

### Formula B — DB Aktual (`simpanTransaksi` di `transaksi.ts`)
```typescript
const final_price_item = Math.round(c.harga_satuan * c.qty * (1 - persen / 100));
// ← round per baris item

const grand_total = itemsHitung.reduce((s, i) => s + i.final_price_item, 0);
```

### Kapan Dua Formula Ini Bisa Berbeda?

Untuk item tunggal:
```
Harga Rp 335, qty 1, diskon 10%

Formula A: subtotal=335, diskon=Math.round(33.5)=34, total=301
Formula B: Math.round(335 × 0.9) = Math.round(301.5) = 302

→ UI menampilkan Rp 301
→ DB menyimpan Rp 302
→ Selisih: 1 rupiah
```

### Analisis Risiko

**Risiko tinggi:** Kasir mengumpulkan uang cash berdasarkan angka di UI (Rp 301), kembalian = uang diterima - 301. Tapi DB menyimpan grand_total = 302. CHECK constraint akan reject INSERT karena `kembalian = uang_diterima - grand_total` tidak terpenuhi.

**Mitigasi yang sudah ada:** CHECK constraint di DB akan menangkap ini saat INSERT — transaksi akan gagal, kasir dapat notif error. Tidak ada data salah yang masuk DB diam-diam.

**Risiko rendah di praktik:** UMKM coffee shop umumnya harga bulat ribuan (Rp 25.000, Rp 30.000). Rp 335 adalah harga yang sangat tidak umum. Dengan harga bulat, kedua formula selalu menghasilkan nilai yang sama.

**Kondisi yang memicu discrepancy:**
- Harga bukan kelipatan bulat (Rp 333, Rp 335, Rp 4.567)
- Persentase diskon yang menghasilkan pecahan yang berbeda ketika dibulatkan per-item vs dibulatkan di total

**Rekomendasi:** Standarisasi ke satu formula. Pilih Formula B (per item) di kedua tempat karena ini yang masuk DB dan yang di-enforce trigger.

```typescript
// Ganti hitungGrandTotal di promo-engine.ts menjadi:
const grandTotal = cart.reduce((s, c) => {
  if (c.item_type === "promo_free") return s;
  return s + Math.round(c.harga_satuan * c.qty * (1 - diskonPersen / 100));
}, 0);
```

---

## Bagian 5: Fidelitas Export/Restore

### Yang TERSIMPAN di BACKUP_HEADERS (siap restore)

```
✅ transaksi_id, nomor_order, created_at
✅ status (completed/void/refund)
✅ payment_method
✅ grand_total, uang_diterima, kembalian
✅ kasir_id
✅ diskon_preset_id (header)
✅ item_id, menu_item_id, nama_produk
✅ harga_satuan, qty, item_type
✅ diskon_persen, diskon_preset_id (item)
✅ final_price_item
```

### Yang TIDAK ADA di BACKUP_HEADERS (hilang saat restore)

```
❌ void_by          → setelah restore, tidak ada jejak SIAPA yang void
❌ void_at          → setelah restore, tidak ada jejak KAPAN void dilakukan
❌ void_reason      → setelah restore, tidak ada jejak KENAPA void
❌ triggered_by_item_id → setelah restore, pairing BOGO hilang
```

### Dampak Restore

| Aspek | Setelah Restore | Impact |
|---|---|---|
| Revenue calculation | ✅ Tetap benar | `status` dan `grand_total` preserved |
| Void/refund identification | ✅ Tetap benar | `status='void'` preserved |
| Audit trail void (siapa/kapan/kenapa) | ❌ Hilang | `void_by`, `void_at`, `void_reason` tidak di-backup |
| BOGO pairing | ❌ Hilang | `triggered_by_item_id` jadi NULL |
| BOGO identification | ✅ Tetap benar | `item_type='promo_free'` preserved |
| Rekap angka (omzet, diskon) | ✅ Tetap benar | Semua angka preserved |

**Kesimpulan:** Untuk keperluan rekap angka (revenue, diskon, void), restore cukup akurat. Untuk audit siapa-kapan-kenapa-void, informasinya hilang setelah restore.

### Kasir ID Setelah Restore

Import code sengaja replace `kasir_id` dari backup dengan owner UUID UMKM yang aktif:
```typescript
// import.ts
const validKasirId = userRow.id;
for (const t of trxList) {
  t.kasir_id = validKasirId;  // override kasir_id dari backup
}
```

Ini benar untuk V1/V2 (single owner). Tapi jika suatu saat ada multi-user, kasir_id historis akan salah setelah restore.

---

## Bagian 6: Analisa Diskon — Konfirmasi Akurasi Nilai

`getAnalisaDiskon` menghitung `total_nilai_diskon` dengan cara:

```typescript
const nilaiDiskon = Math.round(row.harga_satuan * row.qty * row.diskon_persen / 100);
```

**Ini adalah recalculation dari source data** — bukan membaca kolom yang tersimpan. Ini sebenarnya lebih akurat karena menghitung dari data granular.

Tapi ada edge case: kalau `diskon_persen` di item adalah hasil pembulatan berbeda dari preset aslinya (contoh: preset 12.5% disimpan sebagai angka yang presisi?). Cek schema:

```sql
diskon_preset.persen    NUMERIC(5,2)  -- support 12.5%
transaction_items.diskon_persen NUMERIC(5,2) -- sama
```

NUMERIC(5,2) presisi 2 desimal — 12.5% tersimpan sebagai 12.50 dengan tepat. Tidak ada floating point issue di sini.

**Status:** ✅ Kalkulasi diskon akurat.

---

## Bagian 7: Prioritas Fix

Berurutan dari yang paling kritis untuk rekap:

### 🔴 KRITIS — Tambahkan ke Codebase

**Fix 1: Payment Method Breakdown di Dashboard**

Tambahkan ke `getRingkasanOmzet` atau fungsi baru:
```typescript
export interface RingkasanPayment {
  cash: { total: number; jumlah: number; uangDiterima: number; kembalian: number };
  qris: { total: number; jumlah: number };
  transfer: { total: number; jumlah: number };
  debit: { total: number; jumlah: number };
}
```

Ini adalah satu-satunya cara owner bisa rekonsiliasi kas tanpa export.

**Fix 2: Cash Drawer Reconciliation**

Tampilkan di dashboard (bisa bagian dari Fix 1):
```
Ekspektasi kas di laci hari ini = SUM(uang_diterima) - SUM(kembalian)
                                  untuk transaksi cash, completed, hari ini
```

---

### 🔶 PENTING — Tambahkan di V2

**Fix 3: BOGO Value Card di Dashboard**

```typescript
// Tambahkan ke RingkasanOmzet atau card terpisah:
export interface NilaiPromo {
  nilaiBogoBulan: number;    // SUM(harga_satuan × qty) WHERE promo_free
  jumlahItemGratis: number;  // COUNT WHERE item_type = 'promo_free'
}
```

**Fix 4: Struk BOGO — Pisahkan Display BOGO dan Diskon**

```typescript
// struk-print.tsx
// Tampilkan item promo_free dengan label "GRATIS (BOGO)" dan harga 0
// Tampilkan diskon preset (kalau ada) secara terpisah dari nilai BOGO
// Jangan campur keduanya di satu baris "Diskon"
```

**Fix 5: Rounding Formula Konsisten**

Standardisasi `hitungGrandTotal` di `promo-engine.ts` pakai Formula B:
```typescript
const grandTotal = cart.reduce((s, c) => {
  if ((c as any).item_type === "promo_free") return s;
  const base = c.harga_satuan * c.qty;
  return s + (diskonPersen > 0 ? Math.round(base * (1 - diskonPersen / 100)) : base);
}, 0);
```

---

### ⚠️ MINOR — Nice to Have

**Fix 6: Export tambahkan void_by, void_at, void_reason**

Tambahkan ke BACKUP_HEADERS dan export logic:
```
void_by, void_at, void_reason  (dari tabel transaksi)
triggered_by_item_id            (dari tabel transaction_items)
```

**Fix 7: Analisa diskon by transaction (bukan by item row)**

Tambahkan `jumlah_transaksi` ke `AnalisaDiskon`:
```typescript
export interface AnalisaDiskon {
  nama_preset: string;
  kali_dipakai: number;      // per item row (existing)
  jumlah_transaksi: number;  // distinct transaksi_id (new)
  total_nilai_diskon: number;
}
```

---

## Ringkasan Final

```
Yang PASTI AKURAT (tidak bisa salah):
  ✅ grand_total di setiap transaksi (trigger enforcement)
  ✅ void/refund tidak masuk revenue (query filter)
  ✅ snapshot harga historis (immutable transaction_items)
  ✅ nomor order unique dan trackable
  ✅ diskon dari preset (FK tersimpan, bisa di-trace)

Yang ADA TAPI PERLU PERHATIAN:
  🔶 Analisa diskon: per item row, bukan per transaksi
  🔶 Top produk: volume BOGO tercampur dengan volume normal
  🔶 Struk BOGO+diskon: totalDiskon menggabungkan dua jenis pengurangan
  ⚠️ Rounding: dua formula, bisa beda 1 rupiah untuk harga tidak bulat

Yang BELUM ADA DI UI (data ada di DB):
  🔴 Breakdown omzet per payment method
  🔴 Rekonsiliasi kas laci (SUM uang_diterima - kembalian)
  🔴 Total nilai BOGO yang direlakan per bulan

Yang HILANG SETELAH RESTORE:
  ❌ Audit trail void (siapa/kapan/kenapa) → perlu ditambahkan ke backup
  ❌ BOGO pairing (triggered_by_item_id) → rekap tetap benar, audit detail hilang
```

---

> **Satu kalimat:**
> Angka revenue dijamin akurat sampai 1 rupiah — tapi owner belum bisa melihat breakdown
> "berapa cash vs QRIS hari ini" dan "berapa nilai BOGO yang direlakan bulan ini"
> tanpa export Excel. Tiga query itu ada datanya di DB, tinggal dibuat UI-nya.
