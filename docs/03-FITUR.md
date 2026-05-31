# 03 — Fitur Produk: V1 vs V2

---

## Sistem Feature Flag

Satu codebase, mode dikontrol oleh ENV variable:

```
# .env.local
NEXT_PUBLIC_POS_VERSION=v1   ← launch awal (default kalau ENV tidak di-set)
NEXT_PUBLIC_POS_VERSION=v2   ← flip kapanpun siap
```

Implementasi di `src/lib/config/features.ts`:

```typescript
const VERSION = (process.env.NEXT_PUBLIC_POS_VERSION ?? "v1").trim().toLowerCase();
const isV2 = VERSION === "v2";

export const features = {
  paymentExtended: isV2,   // Transfer + Debit di keranjang
  refund: isV2,            // Tombol Refund di riwayat
  promoEngine: isV2,       // BOGO / Buy2Get1 engine
  promoManagement: isV2,   // Card "Program Promo" di pengaturan
} as const;
```

**Penting:** `NEXT_PUBLIC_` prefix karena flag ini dikonsumsi di client component secara synchronous (tidak bisa async). Bukan rahasia — hanya toggle UX.

---

## Perbandingan Fitur Lengkap

| Fitur | V1 | V2 | Dikontrol |
|---|---|---|---|
| **KASIR** | | | |
| Pilih menu dari grid | ✅ | ✅ | — |
| Filter per kategori | ✅ | ✅ | — |
| Input keranjang | ✅ | ✅ | — |
| Pilih preset diskon | ✅ | ✅ | — |
| Payment: Cash + kembalian | ✅ | ✅ | — |
| Payment: QRIS | ✅ | ✅ | — |
| Payment: Transfer Bank | ❌ | ✅ | `paymentExtended` |
| Payment: Kartu Debit | ❌ | ✅ | `paymentExtended` |
| BOGO otomatis di keranjang | ❌ | ✅ | `promoEngine` |
| Cetak struk thermal | ✅ | ✅ | — |
| **RIWAYAT** | | | |
| Lihat riwayat transaksi | ✅ | ✅ | — |
| Badge status (Selesai/VOID) | ✅ | ✅ | — |
| Badge REFUND | ❌ | ✅ | `refund` |
| Void transaksi | ✅ | ✅ | — |
| Refund transaksi | ❌ | ✅ | `refund` |
| **MENU** | | | |
| Tambah / edit / hapus (soft) | ✅ | ✅ | — |
| Toggle ketersediaan harian | ✅ | ✅ | — |
| Kelola kategori | ✅ | ✅ | — |
| **DASHBOARD** | | | |
| Omzet hari ini / minggu / bulan | ✅ | ✅ | — |
| Chart 7 hari | ✅ | ✅ | — |
| Top produk terlaris | ✅ | ✅ | — |
| Analisa penggunaan diskon preset | ✅ | ✅ | — |
| Card nilai refund bulan ini | ❌ | ✅ | — (otomatis jika ada refund) |
| **PENGATURAN** | | | |
| Edit profil UMKM | ✅ | ✅ | — |
| Kelola preset diskon | ✅ | ✅ | — |
| Kelola program promo (BOGO) | ❌ | ✅ | `promoManagement` |
| Export Excel | ✅ | ✅ | — |
| Import restore | ✅ | ✅ | — |
| **AKTIVASI** | | | |
| Aktivasi via kode | ✅ | ✅ | — |
| Seed preset diskon default | ✅ | ✅ | — |

---

## Detail Per Fitur

### Preset Diskon (V1 dan V2)

**Bagaimana:** Owner buat preset di `/pengaturan/diskon`. Kasir pilih dari list saat transaksi. Tidak ada input angka bebas.

**Di V1 dan V2:** Preset selalu dari DB — bukan hardcoded. Seed 4 preset default (5%, 10%, 15%, 20%) otomatis saat aktivasi. Owner bisa edit/tambah/hapus kapanpun.

**Kenapa tidak hardcoded:** Owner UMKM punya kebijakan diskon yang berbeda-beda. Preset hardcoded = harus update app untuk ganti diskon.

**Data flow:**
```
diskon_preset.persen
    → diskon-input.tsx (pilihan tombol)
    → kasir/page.tsx (diskonPresetId + diskonPersen state)
    → simpanTransaksi (diskon header)
    → transaction_items.diskon_persen + diskon_preset_id
    → Trigger cek grand_total
```

**Analisa di dashboard:** `top-diskon.tsx` menampilkan preset yang paling banyak dipakai + total nilai diskon yang diberikan.

---

### Payment Methods

**V1:** Cash dan QRIS

**V2:** + Transfer Bank + Kartu Debit

**Cash (V1 + V2):**
- Kasir input "uang diterima"
- Kembalian dihitung real-time di UI
- `uang_diterima` dan `kembalian` disimpan ke DB
- CHECK constraint memastikan `kembalian = uang_diterima - grand_total`
- Rekonsiliasi: `SUM(uang_diterima) - SUM(kembalian)` = uang yang harusnya ada di laci

**QRIS / Transfer / Debit (konfirmasi manual):**
- Kasir konfirmasi bahwa pembayaran sudah diterima
- `uang_diterima = null`, `kembalian = null`
- Tidak ada payment gateway — kasir verify sendiri

---

### Void Transaksi (V1 dan V2)

**Trigger:** Owner klik "Void" di detail transaksi di halaman riwayat.

**Efek:**
```
status = 'void'
void_by = owner_id (dari cookie)
void_at = now()
void_reason = "Dibatalkan oleh owner" (default)
```

**Catatan:**
- Transaksi tidak hilang dari riwayat
- Tidak masuk hitungan omzet (filter `status = 'completed'`)
- CHECK constraint memaksa `void_by` dan `void_at` ada jika status = 'void'
- Hanya bisa void transaksi yang `status = 'completed'`

---

### Refund Transaksi (V2 only)

**Trigger:** Owner klik "Refund" di detail transaksi, isi alasan (wajib).

**Perbedaan dari Void:**
- **Void:** Transaksi dibatalkan, tidak ada uang keluar. Biasanya salah input.
- **Refund:** Pembeli sudah bayar, minta uang kembali. Ada uang yang keluar dari kas.

**Efek:**
```
status = 'refund'
void_by = owner_id
void_at = now()
void_reason = alasan yang diisi (wajib)
```

**Di dashboard:** Card "Refund bulan ini" muncul otomatis jika ada transaksi refund (`jumlahRefundBulan > 0`).

---

### BOGO Engine (V2 only)

**Trigger:** Otomatis saat kasir menambah item yang punya promo rule aktif ke keranjang.

**Jenis promo:**
- `bogo` (Buy 1 Get 1): qty_beli=1, qty_gratis=1
- `buy2get1` (Buy 2 Get 1): qty_beli=2, qty_gratis=1

**Formula:**
```
jumlah_gratis = FLOOR(qty_dipesan / (qty_beli + qty_gratis))
qty_bayar     = qty_dipesan - jumlah_gratis
```

**Contoh BOGO (beli 4 Americano):**
```
jumlah_gratis = FLOOR(4 / (1+1)) = 2
qty_bayar     = 4 - 2 = 2

DB records:
  Row 1: Americano, qty=1, item_type=normal, triggered_by=NULL
  Row 2: Americano, qty=1, item_type=promo_free, triggered_by=Row1.id
  Row 3: Americano, qty=1, item_type=normal, triggered_by=NULL
  Row 4: Americano, qty=1, item_type=promo_free, triggered_by=Row3.id
```

**Setiap pasangan punya link tersendiri** — bukan semua row gratis pointing ke baris pertama.

**Aturan penting:**
- Item `promo_free` tidak kena diskon header (`final_price_item = 0`, `diskon_persen = 0` dipaksa server)
- Kasir tidak perlu tahu ada promo — item gratis otomatis muncul di keranjang
- INSERT sequential (bukan batch) karena `triggered_by_item_id` butuh UUID dari baris sebelumnya

**Tampilan di keranjang:**
- Item bayar: tampil dengan kontrol qty seperti biasa
- Item gratis: read-only, badge "GRATIS (BOGO)", harga Rp 0

---

### Dashboard

**Tersedia di V1 dan V2:**
- Omzet hari ini (highlight card)
- Omzet minggu ini + jumlah transaksi
- Omzet bulan ini + jumlah transaksi
- Chart bar 7 hari terakhir
- Top 5 produk terlaris (bulan ini, qty + omzet)
- Analisa diskon preset (bulan ini, frekuensi + nilai)

**Semua query filter `status = 'completed'`** — void dan refund tidak masuk omzet.

**Refund card (otomatis di V2):**
Muncul di bawah stat bulanan jika `jumlahRefundBulan > 0`. Tidak ada flag khusus — data-driven.

**Reminder backup:**
Banner muncul jika sudah 7+ hari tidak backup dan ada transaksi bulan ini.

---

### Export / Import Excel

**Export:**
- Sheet "Laporan": human-readable, semua transaksi + status + total
- Sheet "BACKUP_DATA": machine-readable, siap untuk import restore
- Download langsung ke device

**Import:**
- Destruktif — hapus semua data transaksi, isi ulang dari file backup
- Validasi header kolom sebelum proses
- `kasir_id` dari backup di-replace dengan owner UUID UMKM yang aktif (backup bisa dari device lain)

**BACKUP_HEADERS (kolom yang di-validasi saat import):**
```
transaksi_id, nomor_order, created_at, status, payment_method,
grand_total, uang_diterima, kembalian, kasir_id, diskon_preset_id,
item_id, menu_item_id, nama_produk, harga_satuan, qty, item_type,
diskon_persen, diskon_preset_id_item, final_price_item
```

---

## Logika Feature Flag di Komponen

### `features.paymentExtended` — `keranjang-panel.tsx`
```typescript
const paymentMethods = features.paymentExtended
  ? ["cash", "qris", "transfer", "debit"]
  : ["cash", "qris"];
// Tampilkan grid payment method sesuai list
```

### `features.refund` — `riwayat/page.tsx`
```typescript
// Tombol Void: selalu ada
<Button onClick={handleVoid}>Void</Button>

// Tombol Refund: hanya V2
{features.refund && (
  <Button onClick={() => setShowRefundForm(true)}>Refund</Button>
)}
```

### `features.promoEngine` — `kasir/page.tsx`
```typescript
// Load promo rules hanya di V2
features.promoEngine
  ? getPromoAktif(umkmId)
  : Promise.resolve([])

// Apply promo engine
const cart = features.promoEngine
  ? applyPromo(cartRaw, promoRules)
  : cartRaw;
```

### `features.promoManagement` — `pengaturan/page.tsx`
```typescript
// Card Preset Diskon: selalu tampil (V1 dan V2)
<Card>Preset Diskon</Card>

// Card Program Promo: hanya V2
{features.promoManagement && (
  <Card>Program Promo</Card>
)}
```

---

## Fitur Masa Depan (Bukan di V1/V2)

Yang ada di dokumen roadmap lama tapi belum diimplementasikan dan tidak dalam scope V1/V2:

| Fitur | Status | Keterangan |
|---|---|---|
| Multi-user / kasir terpisah | V3 (hipotetis) | Butuh Supabase Auth + RLS |
| Login screen | V3 (hipotetis) | Bergantung multi-user |
| Laporan per kasir | V3 (hipotetis) | Bergantung multi-user |
| Auto-reset `is_available` harian | Backlog | Butuh scheduled job |
| Overlap promo validation di UI | Backlog | Saat ini hanya cek di DB level |
| Filter dashboard per kasir | V3 (hipotetis) | Bergantung multi-user |
