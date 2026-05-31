# 06 — Utang Teknis & Known Limitations

> Ini bukan bug yang tidak disadari.
> Ini adalah lubang yang disadari, terdokumentasi, dan diserahkan ke application layer secara eksplisit.

---

## Known Limitations

### KL-01: Overlap Promo Periode Tidak Dicegah DB

**Masalah:** `UNIQUE(umkm_id, menu_item_id, tipe_promo)` mencegah tipe yang sama untuk item yang sama, tapi tidak mencegah dua promo dengan periode yang overlap. Contoh: BOGO Americano 1-15 Juni dan BOGO Americano 10-20 Juni bisa keduanya diinsert.

**Enforcement:** Application layer. `promo-rule.ts` harus query promo aktif sebelum INSERT, cek apakah ada overlap periode.

**Status:** Cek overlap belum diimplementasikan di UI — owner bisa buat promo overlap tanpa warning. Saat kasir load promo, engine hanya ambil promo pertama yang aktif (karena UNIQUE per tipe).

**Solusi masa depan:** Validasi di `form-promo-rule.tsx` sebelum submit.

---

### KL-02: `is_available` Tidak Ada Auto-Reset Harian

**Masalah:** Kasir set `is_available = FALSE` karena stok habis. Tidak ada mekanisme otomatis reset ke TRUE keesokan harinya. Kalau lupa toggle balik, item tidak muncul berhari-hari.

**Trade-off:** Toggle manual. Simpel, tidak perlu scheduled job.

**Solusi masa depan:** Supabase Edge Function atau cron job yang reset semua `is_available = TRUE` setiap tengah malam Jakarta.

---

### KL-03: `generate_nomor_order` Tidak Atomic untuk Multi-User

**Masalah:** Logic adalah `SELECT MAX(nomor_order) WHERE hari ini` → +1. Kalau ada dua session yang submit transaksi bersamaan (concurrent), keduanya bisa dapat nomor yang sama → `UNIQUE(umkm_id, nomor_order)` akan reject salah satu.

**Saat ini aman:** Single owner, tidak ada concurrent INSERT dari dua session berbeda.

**⚠️ HARUS DIFIX sebelum ada kasir kedua.** Ganti ke PostgreSQL sequence atau `SELECT ... FOR UPDATE` di row counter terpisah.

---

### KL-04: RLS Disabled — Isolasi via Application Layer

**Masalah:** Tidak ada Row Level Security. Jika ada satu query yang lupa `.eq('umkm_id', ...)`, data UMKM lain bisa terbaca.

**Mitigasi saat ini:** Semua fungsi di `src/lib/db/*.ts` sudah include filter `umkm_id`. Tidak ada query yang bisa return data cross-tenant secara tak sengaja — selama tidak ada typo/omission di kode.

**Solusi masa depan (V3):** Aktifkan RLS dengan Supabase Auth JWT. Policy berbasis JWT claim `user_metadata.umkm_id`.

**⚠️ Jangan disable ini sebagai "optimasi."** RLS disabled adalah trade-off sadar untuk V1/V2 karena tidak ada Supabase Auth. Kalau suatu saat Auth diimplementasikan, RLS harus langsung diaktifkan.

---

### KL-05: `triggered_by_item_id` Dijaga Trigger, Bukan FK Constraint

**Masalah:** Integritas `triggered_by_item_id` (bahwa UUID item pemicu ada di transaksi yang sama) dijaga oleh trigger `trg_validate_triggered_by_same_transaction`, bukan FK constraint dengan `ON DELETE CASCADE/RESTRICT`.

**Kenapa tidak FK:** FK ke self-referential column dengan constraint "harus di transaksi yang sama" tidak bisa diekspresikan sebagai FK biasa di PostgreSQL.

**Mitigasi:** Semua INSERT lewat `simpanTransaksi` di application layer yang sudah handle sequential INSERT dengan benar. Tidak ada akses bulk INSERT langsung ke DB.

---

### KL-06: Import Restore Tidak Validasi Grand Total

**Masalah:** Saat import dari backup Excel, data di-insert langsung tanpa re-validate apakah `grand_total` konsisten dengan `SUM(final_price_item)` di items-nya.

**Kenapa ini aman:** File backup berasal dari export yang sudah divalidasi oleh trigger saat data aslinya diinsert. Selama file backup tidak dimanipulasi manual, data yang di-import sudah valid.

**Risiko:** Kalau seseorang mengedit file backup Excel secara manual dan mengubah angka, import bisa sukses dengan data yang tidak konsisten.

**Solusi:** Tidak diprioritaskan karena edge case yang sangat spesifik. Trigger `check_grand_total` akan reject INSERT kalau angka tidak cocok — tapi hanya kalau trigger aktif saat import.

---

## Utang Teknis yang Harus Diselesaikan Sebelum Go-Live V1

```
☐ Unit test formula rounding
    ROUND(harga × qty × (1 - persen/100), 0) harus konsisten
    antara preview di UI dan nilai yang tersimpan di DB

☐ Unit test formula BOGO
    Test dengan berbagai kombinasi qty:
    qty=1 (belum trigger), qty=2 (1 gratis), qty=3 (1 gratis), qty=4 (2 gratis)
    Verifikasi jumlah_gratis dan qty_bayar

☐ Integration test: trigger grand_total menolak INSERT yang salah
    Insert transaction_items dengan SUM yang tidak cocok → harus RAISE EXCEPTION

☐ Integration test: soft delete tidak merusak riwayat
    Soft delete menu item → riwayat transaksi lama tetap bisa dibaca
    nama_produk di transaction_items tetap ada (snapshot)

☐ Smoke test aktivasi kode:
    - Kode baru → seed users + preset + config
    - Kode yang sudah dipakai → re-aktivasi return umkm_id yang sama
    - Kode tidak ada → 404
```

## Utang Teknis yang Harus Diselesaikan Sebelum Go-Live V2

```
☐ Unit test promo engine (KL-01 terkait)
    Test applyPromo() dengan berbagai skenario:
    - Item tanpa promo: cart tidak berubah
    - BOGO qty=1: tidak ada item gratis
    - BOGO qty=2: 1 item gratis
    - BOGO qty=4: 2 item gratis (2 pasang)
    - Buy2Get1 qty=3: 1 item gratis
    - Mix: 2 item berbeda, keduanya BOGO aktif
    - BOGO + diskon header: item gratis tidak kena diskon

☐ Validasi overlap promo di UI (KL-01)
    form-promo-rule.tsx: cek sebelum submit apakah ada promo
    aktif yang periode-nya overlap untuk item yang sama

☐ Integration test: triggered_by_item_id terisi benar
    Verifikasi setelah transaksi BOGO: UUID di triggered_by_item_id
    menunjuk ke row yang benar dalam transaksi yang sama
```

---

## Yang Tidak Ada dan Tidak Akan Ada (V1/V2)

| Item | Alasan tidak ada | Kapan bisa ada |
|---|---|---|
| Multi-user / login kasir | Fundamental architecture change, butuh Supabase Auth | V3 (hipotetis) |
| RLS aktif | Butuh Supabase Auth JWT | V3 bersamaan dengan auth |
| Filter dashboard per kasir | Tidak ada multi-user | V3 |
| Payment gateway (Midtrans, Xendit) | Di luar scope produk | Bukan roadmap |
| Settlement QRIS otomatis | Butuh payment gateway | Bukan roadmap |
| Multi-outlet | Di luar scope produk | Bukan roadmap |
| Inventory / stok quantity | Di luar scope produk | Bukan roadmap |
| PPN / pajak | Di luar scope produk | Bukan roadmap |
| Auto-reset is_available | Butuh scheduled job | Backlog |
| Loyalty points | Di luar scope produk | Bukan roadmap |

---

## Jalan Menuju V3 (Hipotetis, Belum Didesain)

Kalau suatu saat ada kebutuhan multi-user, ini yang perlu dikerjakan:

### V3 Prerequisites

1. **Supabase Auth integration**
   - Buat akun Supabase Auth per user (email dummy: `{username}@{umkm_id}.pos`, password = PIN)
   - Session dari Supabase Auth replace cookie `owner_id`
   - `users.auth_id` mulai dipakai

2. **RLS re-enable**
   - Update semua policy dari `app.current_umkm_id` ke `auth.jwt()->'user_metadata'->'umkm_id'`
   - Enable RLS di semua tabel
   - Hapus semua `.eq('umkm_id', ...)` manual (RLS yang handle)
   - **Test isolasi:** dua browser, dua UMKM berbeda, data tidak bocor

3. **Kasir tracking yang proper**
   - Fix KL-03: `generate_nomor_order` harus atomic
   - `kasir_id` di transaksi mulai bermakna (siapa yang transaksi, bukan hanya system user)

### V3 Features

- Login screen (username + PIN 6 digit)
- Manajemen kasir: tambah, nonaktifkan, reset PIN
- Laporan per kasir: omzet kasir A vs kasir B
- Role-based navigation: kasir hanya lihat Kasir + Riwayat
- `void_by` berbeda dari `kasir_id` — owner void bukan kasir yang transaksi

---

## Rounding — Aturan yang Tidak Boleh Berubah

```
final_price_item = ROUND(harga_satuan × qty × (1 - diskon_persen / 100), 0)

Aturan:
  1. Kalikan dulu (harga × qty × faktor_diskon)
  2. Bulatkan sekali di akhir
  3. Round half up (bukan banker's rounding)
  4. Satuan: Rupiah bulat (integer)

JANGAN:
  - Bulatkan harga satuan dulu, baru kalikan
  - Bulatkan di UI berbeda dengan di server
  - Gunakan floating point tanpa sadar
```

Selisih 1 rupiah per item × 200 transaksi/hari × 30 hari = Rp 6.000/bulan rekap tidak cocok dengan kas fisik.

---

## Referensi Cepat Error yang Mungkin Terjadi

| Error | Penyebab | Fix |
|---|---|---|
| `FK violation pada kasir_id` | Row di `users` belum ada saat aktivasi | Re-run aktivasi / periksa seed users di route.ts |
| `CHECK constraint violation: grand_total` | SUM items tidak cocok dengan grand_total header | Bug di kalkulasi server — tidak boleh terjadi di production |
| `UNIQUE violation: nomor_order` | Concurrent INSERT (KL-03) | Edge case, tidak terjadi untuk single owner |
| `CHECK violation: qty_gratis < qty_beli` | Promo BOGO gagal insert | Pastikan schema v3.1 sudah dirun (FIX-01) |
| `CHECK violation: discounted item` | Diskon tanpa preset_id | Pastikan schema v3.1 sudah dirun (FIX-02) |
| Query return kosong untuk semua data | Cookie `umkm_id` tidak ada atau salah | Cek cookie, re-aktivasi kalau perlu |
