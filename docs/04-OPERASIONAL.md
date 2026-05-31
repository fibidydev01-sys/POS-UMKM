# 04 — Flow Operasional

---

## Flow Kasir: Dari Input sampai Struk

### Step 1 — Identitas Sudah Ada

Owner tidak perlu login. Cookie `umkm_id` dan `owner_id` sudah ada sejak aktivasi (lifetime 5 tahun). Buka app → langsung ke halaman kasir.

`getCurrentUser()` membaca cookie `owner_id` → query `users` table → return user object untuk `kasir_id` dan `updated_by`.

### Step 2 — Load Data Kasir

Saat halaman kasir dibuka, paralel load:
```typescript
const [menu, kategori, config, presets, promoRules] = await Promise.all([
  getMenuTersedia(umkmId),       // is_active=true AND is_available=true
  getKategori(umkmId),           // is_active=true
  getConfig(umkmId),             // profil UMKM
  getDiskonPreset(umkmId),       // is_active=true (V1 dan V2)
  features.promoEngine           // hanya V2
    ? getPromoAktif(umkmId)      // is_active=true, belum expired
    : Promise.resolve([]),
]);
```

### Step 3 — Input Pesanan

- Kasir tap item dari grid → masuk ke `cartRaw`
- Filter per kategori tersedia
- Indikator qty di sudut kanan atas kartu item

**Di V2 (BOGO aktif):**
Setiap kali `cartRaw` berubah, `applyPromo(cartRaw, promoRules)` dijalankan → hasilkan `cart` yang sudah include item gratis. Kasir tidak perlu tahu ada promo.

### Step 4 — Pilih Diskon (Opsional)

Panel keranjang menampilkan tombol preset dari DB. Kasir pilih satu atau lewati.

Pilih preset → `diskonPresetId` + `diskonPersen` di-set di state kasir.

### Step 5 — Pilih Metode Bayar

- **V1:** Cash atau QRIS
- **V2:** Cash, QRIS, Transfer, Debit

**Kalau Cash:** Kasir input "uang diterima". Kembalian dihitung real-time:
```
kembalian = uangDiterima - grandTotal
```
Tombol bayar di-disable selama `uangDiterima < grandTotal`.

**Kalau non-Cash:** Kasir konfirmasi pembayaran sudah diterima. Tidak ada input nominal.

### Step 6 — Submit ke Server

Saat kasir tekan "Bayar":

```
1. Validasi: cartRaw.length > 0, user ada, saving = false
2. Kalau cash: uangDiterima >= grandTotal
3. Panggil simpanTransaksi(umkmId, userId, cart, presetId, persen, method, uang)
```

**Di dalam `simpanTransaksi` (server logic):**

```
Untuk setiap item di cart:

  JIKA item_type = 'promo_free':
    final_price_item = 0
    diskon_persen    = 0
    diskon_preset_id = NULL
    (tidak pernah kena diskon header)

  JIKA item lainnya DAN ada diskon header (diskonPersen > 0):
    item_type        = 'discounted'
    diskon_persen    = diskonPersen
    diskon_preset_id = diskonPresetId
    final_price_item = ROUND(harga_satuan × qty × (1 - persen/100), 0)

  JIKA item lainnya DAN tidak ada diskon:
    item_type        = 'normal'
    diskon_persen    = 0
    final_price_item = harga_satuan × qty

grand_total = SUM(semua final_price_item)
kembalian   = uangDiterima - grand_total (hanya untuk cash)

nomor_order = await generate_nomor_order(umkmId)  ← DB function

INSERT transaksi header (dengan grand_total hasil kalkulasi server)
INSERT transaction_items (sequential untuk V2 promo, batch untuk V1)
Trigger DB validasi: SUM(final_price_item) == grand_total
```

### Step 7 — Sequential INSERT untuk BOGO (V2)

Karena `triggered_by_item_id` FK ke `transaction_items(id)` dalam transaksi yang sama, INSERT tidak bisa batch — harus sequential:

```
Loop setiap item di cart:
  JIKA item promo_free:
    Cari UUID dari pasangan normal-nya (sudah di-INSERT sebelumnya)
    SET triggered_by_item_id = UUID tersebut

  INSERT satu baris ke transaction_items
  Simpan UUID hasil INSERT untuk pasangan promo_free berikutnya

Trigger check_triggered_by_same_transaction: validasi UUID ada di transaksi yang sama
Trigger check_grand_total (DEFERRED): validasi SUM setelah semua items ter-INSERT
```

**Kalau INSERT item gagal:**
```
Rollback: UPDATE transaksi SET status='void', void_reason='Rollback: gagal INSERT items'
Throw error → kasir dapat notif "Gagal menyimpan transaksi"
```

### Step 8 — Struk

Setelah transaksi berhasil:
- Dialog struk muncul otomatis
- Kasir bisa print ke thermal printer via `window.print()`
- CSS `@media print` hanya tampilkan `#area-struk` — lebar 58mm
- Tombol "Transaksi Baru" reset semua state kasir

---

## Formula BOGO

**Formula ini TIDAK BOLEH BERUBAH. Ditulis di tiga tempat: dokumen ini, komentar kode, unit test.**

```
qty_gratis_total = FLOOR(qty_dipesan / (qty_beli + qty_gratis)) × qty_gratis
qty_bayar        = qty_dipesan - qty_gratis_total
```

### Tabel BOGO (qty_beli=1, qty_gratis=1)

| Pesan | Gratis | Bayar |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 1 | 1 |
| 3 | 1 | 2 |
| 4 | 2 | 2 |
| 5 | 2 | 3 |
| 6 | 3 | 3 |

### Tabel Buy2Get1 (qty_beli=2, qty_gratis=1)

| Pesan | Gratis | Bayar |
|---|---|---|
| 2 | 0 | 2 |
| 3 | 1 | 2 |
| 4 | 1 | 3 |
| 5 | 1 | 4 |
| 6 | 2 | 4 |

### Struktur DB untuk 4 Americano BOGO

```
Row 1: nama=Americano, qty=1, item_type=normal,      triggered_by=NULL,    final_price=25000
Row 2: nama=Americano, qty=1, item_type=promo_free,  triggered_by=Row1.id, final_price=0
Row 3: nama=Americano, qty=1, item_type=normal,      triggered_by=NULL,    final_price=25000
Row 4: nama=Americano, qty=1, item_type=promo_free,  triggered_by=Row3.id, final_price=0

grand_total = 25000 + 0 + 25000 + 0 = 50000
```

Bukan semua row gratis pointing ke baris 1 — setiap pasangan punya link tersendiri.

---

## Logika Kalkulasi Server (Ringkasan)

```
SEBELUM INSERT ke database:

1. Untuk setiap item:
   - promo_free    → final_price=0, diskon=0, tidak kena diskon header
   - ada diskon    → jadi 'discounted', hitung ROUND(harga×qty×(1-persen/100), 0)
   - tanpa diskon  → tetap 'normal', final_price = harga×qty

2. grand_total = SUM(semua final_price_item)

3. Cash: kembalian = uang_diterima - grand_total
   Non-cash: uang_diterima = NULL, kembalian = NULL

4. INSERT header (grand_total dari server, BUKAN dari UI)
5. INSERT items (sequential untuk BOGO)
6. Trigger validasi: SUM(final_price) == grand_total → ROLLBACK kalau tidak cocok
```

---

## Void Flow

**Siapa:** Hanya owner (satu-satunya user)
**Dari:** Halaman Riwayat → klik transaksi → tombol "Void"
**Konfirmasi:** Dialog konfirmasi sebelum eksekusi

```typescript
await voidTransaksi(transaksiId, ownerId);
// UPDATE transaksi SET
//   status = 'void',
//   void_by = ownerId,
//   void_at = now(),
//   void_reason = 'Dibatalkan oleh owner'
// WHERE id = transaksiId AND status = 'completed'
```

**Catatan:** Hanya bisa void transaksi `completed`. Transaksi yang sudah void/refund tidak bisa di-void lagi.

---

## Refund Flow (V2 Only)

**Siapa:** Hanya owner
**Dari:** Halaman Riwayat → klik transaksi → tombol "Refund"
**Alasan:** Wajib diisi (textarea)

```typescript
await refundTransaksi(transaksiId, ownerId, alasanRefund);
// UPDATE transaksi SET
//   status = 'refund',
//   void_by = ownerId,
//   void_at = now(),
//   void_reason = alasanRefund  ← wajib diisi, bukan default
// WHERE id = transaksiId AND status = 'completed'
```

**Di dashboard:** Card "Refund bulan ini" muncul otomatis jika `jumlahRefundBulan > 0` dari query `getRingkasanOmzet`.

---

## Format Struk Thermal

Lebar: 58mm. Font: monospace. Print via `window.print()` + CSS `@media print`.

```
[NAMA UMKM]
[Alamat]
[No. Telepon]
================================
No #YYYYMMDD-XXXX   [Payment]
[Tanggal] · [Jam]
================================
[Nama Item 1]
  [qty] x [harga_satuan]        [subtotal]

[Nama Item 2]                   ← item gratis
  GRATIS (BOGO)                    Rp 0

[Nama Item 3]                   ← item kena diskon
  [qty] x [harga_satuan]        [subtotal]
  Diskon [persen]%              -[diskon]

--------------------------------
Subtotal                        [jumlah]
Diskon [preset.nama] [persen]%  -[nilai]
================================
TOTAL                           [grand_total]
================================
Bayar (Tunai)                   [uang_diterima]    ← hanya cash
Kembalian                       [kembalian]        ← hanya cash
================================
[Footer UMKM]
```

**Kolom wajib ada di struk:**
- `nomor_order`
- Tanggal + jam (zona Jakarta)
- List item: nama, qty, harga satuan
- Item gratis dari BOGO: nama, qty, label "GRATIS (BOGO)" — bukan "Rp 0" tanpa keterangan
- `grand_total`
- `payment_method` (Tunai / QRIS / Transfer / Debit)
- Cash: `uang_diterima` + `kembalian`
- Void: label "*** VOID ***"

---

## Nomor Order

**Format:** `YYYYMMDD-XXXX` (contoh: `20250529-0042`)
**Timezone:** Asia/Jakarta
**Reset:** Setiap hari (urutan mulai dari 0001)
**Unique:** `UNIQUE(umkm_id, nomor_order)` di DB

**Generate via DB function:**
```typescript
const nomor_order = await supabase.rpc("generate_nomor_order", { p_umkm_id: umkmId });
```

**⚠️ KL-03:** SELECT MAX+1 tidak aman untuk concurrent INSERT. Untuk single owner tidak ada masalah karena tidak ada concurrent session.

---

## Struk VOID

Kalau owner cetak ulang transaksi yang sudah di-void:
```
[NAMA UMKM]
...
No #20250529-0042   Tunai
...
*** VOID ***
...
```

Label `*** VOID ***` muncul di area transaksi, bukan di footer.
