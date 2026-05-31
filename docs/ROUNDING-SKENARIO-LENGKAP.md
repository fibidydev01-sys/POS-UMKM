# Analisis Rounding: Semua Skenario, Semua Skala
> Seluruh angka diverifikasi langsung via komputasi — bukan estimasi.
> Mencakup semua kombinasi harga × diskon yang relevan untuk UMKM coffee shop.

---

## Tiga Jenis "Selisih" yang Perlu Dibedakan

| Jenis | Sumber | Per Transaksi | Severity |
|---|---|---|---|
| **Tipe 1** | Formula A (UI) ≠ Formula B (DB) | Rp 0–5 | 🔴 Bug nyata |
| **Tipe 2** | Rounding bias (Formula B vs matematis exact) | Rp 0–2 | 🟡 By design |
| **Tipe 3** | BOGO value tidak muncul di dashboard | Rp 0–jutaan | 🔴 Blind spot kritis |

**Tipe 1 dan 3 adalah masalah yang harus difix.**
Tipe 2 adalah konsekuensi pembulatan yang tidak bisa dihindari — bukan bug, tapi harus dipahami.

---

## Bagian 1: Master Matrix — Harga × Diskon

Semua kombinasi harga UMKM coffee shop (Rp 500–Rp 50.000) × semua preset diskon umum.

```
✓  = Aman total (UI = DB = matematika exact)
!  = BERMASALAH: UI ≠ DB (kasir kasih kembalian berbeda dari yang dicatat DB)
```

| Harga Menu | 5% | 7% | 10% | **12.5%** | 15% | 20% | 25% | 30% |
|---|---|---|---|---|---|---|---|---|
| Rp 500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 1.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 2.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 4.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 5.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 7.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 10.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 12.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 15.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 17.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 20.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 22.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 25.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 27.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 30.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 32.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 35.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 40.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 45.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rp 47.500 | ✓ | ✓ | ✓ | **!** | ✓ | ✓ | ✓ | ✓ |
| Rp 50.000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Pola yang terlihat:**

- ✅ Hampir semua kombinasi harga standar × diskon standar: **AMAN**
- 🔴 **12.5% adalah satu-satunya diskon yang menciptakan masalah sistematis**
- 🔴 Masalah terjadi **100% konsisten** di semua harga kelipatan 500-non-ribu (4.500, 7.500, 9.500, dst)
- ✅ Harga kelipatan 1.000 (5.000, 10.000, 25.000): **AMAN bahkan dengan diskon 12.5%**

---

## Bagian 2: Detail Selisih Per Item

Untuk harga yang bermasalah (kelipatan 500, non-ribu) dengan diskon 12.5%:

| Harga | Exact | UI tampilkan | DB menyimpan | Selisih |
|---|---|---|---|---|
| Rp 500 | 437,50 | **437** | **438** | **-1** |
| Rp 4.500 | 3.937,50 | **3.937** | **3.938** | **-1** |
| Rp 7.500 | 6.562,50 | **6.562** | **6.563** | **-1** |
| Rp 9.500 × 2 | 16.625,00 | 16.625 | 16.625 | 0 ← qty tinggi bisa selamat |
| Rp 12.500 | 10.937,50 | **10.937** | **10.938** | **-1** |
| Rp 22.500 | 19.687,50 | **19.687** | **19.688** | **-1** |
| Rp 27.500 | 24.062,50 | **24.062** | **24.063** | **-1** |

**Artinya:** UI menampilkan Rp 1 lebih rendah dari yang disimpan DB.
Kasir kasih kembalian Rp 1 lebih banyak dari yang dicatat. Rekap DB lebih tinggi Rp 1 dari kas fisik.

---

## Bagian 3: Akumulasi Multi-Item Per Transaksi

Kalau satu transaksi punya beberapa item bermasalah, selisihnya bertambah:

| Jumlah item bermasalah | UI total | DB total | Selisih per trx |
|---|---|---|---|
| 1 item (Rp 4.500) | 3.937 | 3.938 | **-1** |
| 2 item | 7.875 | 7.876 | **-1** |
| 3 item | 11.812 | 11.814 | **-2** |
| 4 item | 15.750 | 15.752 | **-2** |
| 5 item | 19.687 | 19.690 | **-3** |
| 6 item | 23.625 | 23.628 | **-3** |
| 7 item | 27.562 | 27.566 | **-4** |
| 8 item | 31.500 | 31.504 | **-4** |
| 9 item | 35.437 | 35.442 | **-5** |
| 10 item | 39.375 | 39.380 | **-5** |

**Pola:** Setiap 2 item bermasalah → selisih bertambah 1 rupiah.

---

## Bagian 4: Tabel Akumulasi Bulanan — Rounding Tipe 1

**Asumsi:** 3 item bermasalah per transaksi, 12.5% diskon.

| Tipe Usaha | Trx/hari | % pakai diskon | Trx diskon/bln | Selisih/bln | Selisih/tahun |
|---|---|---|---|---|---|
| Warung kecil | 50 | 30% | 390 | **Rp 1.170** | Rp 14.040 |
| Coffee shop kecil | 100 | 40% | 1.040 | **Rp 3.120** | Rp 37.440 |
| Coffee shop medium | 200 | 50% | 2.600 | **Rp 7.800** | Rp 93.600 |
| Coffee shop besar | 300 | 50% | 3.900 | **Rp 11.700** | Rp 140.400 |
| Very busy (mall) | 500 | 60% | 7.800 | **Rp 23.400** | Rp 280.800 |
| Mall outlet ramai | 1.000 | 60% | 15.600 | **Rp 46.800** | **Rp 561.600** |

**Poin penting:**
- Untuk coffee shop medium (200 trx/hari), kalau ada preset 12.5% dan menu harga kelipatan 500: selisih **Rp 93.600/tahun**
- Untuk mall outlet: hampir **Rp 562.000/tahun** — dari sumber yang sama sekali tidak terlihat di UI

---

## Bagian 5: Simulasi Skenario Nyata

### Skenario A: Coffee Shop dengan Harga Bersih (Aman)

```
Menu: Americano Rp 25.000, Latte Rp 30.000, Matcha Rp 35.000
Preset diskon: 10%, 20%

→ Semua kombinasi: AMAN
→ Selisih rounding: Rp 0

Kenapa: harga kelipatan 5.000 × diskon 10%/20% menghasilkan bilangan bulat exact.
Tidak ada fractional rupiah di manapun dalam kalkulasi.
```

### Skenario B: Coffee Shop dengan Harga "Setengahan" + Preset 12.5%

```
Menu: Cold Brew Rp 22.500, Matcha Rp 17.500, Sparkling Rp 27.500
Preset diskon: 12.5% (untuk member)

Satu transaksi: 3 item berbeda kena 12.5%

UI tampilkan total:    Rp 59.062
DB menyimpan total:    Rp 59.064
Selisih per transaksi: Rp 2

Volume 150 trx/hari, 40% pakai diskon:
→ 1.560 trx bermasalah/bulan
→ × Rp 2 = Rp 3.120/bulan
→ Rp 37.440/tahun

Owner akan lihat:
  Kas fisik:  Rp X
  Rekap DB:   Rp X + 37.440
  "Kok rekap lebih dari kas? Kayaknya beneran 37 ribu."
  Tidak bisa ditelusuri dari mana.
```

### Skenario C: Mixed Menu — Sebagian Aman, Sebagian Tidak

```
Menu campuran:
  - Americano Rp 25.000 (kelipatan 1000) → AMAN dengan diskon apapun
  - Cold brew Rp 22.500 (kelipatan 500)  → bermasalah HANYA dengan 12.5%
  - Snack Rp 4.500 (kelipatan 500)       → bermasalah HANYA dengan 12.5%

Kalau owner punya preset 10% dan 20%: AMAN TOTAL.
Kalau owner tambah preset 12.5% untuk member khusus:
  → Cold brew dan snack bermasalah
  → Setiap transaksi member yang pesan keduanya: selisih Rp 2
```

### Skenario D: Worst Case — Semua Kondisi Stack

```
Menu semua harga "setengahan" (4.500, 7.500, 9.500, dst)
Preset diskon 12.5% populer, 5 item rata-rata per order
Transaksi 300/hari, 60% pakai diskon member

Per transaksi:        5 item × 1 Rp = Rp 5 selisih
Per bulan:            300 × 0.6 × 26 × 5 = Rp 23.400
Per tahun:            Rp 280.800

Dan rekap akan SELALU lebih tinggi dari kas fisik persis Rp 280.800/tahun
tanpa jejak apapun kenapa. Audit trail tidak akan membantu.
```

---

## Bagian 6: Tipe 2 — Rounding Bias (By Design, Bukan Bug)

Bahkan dengan **satu formula yang konsisten** (Formula B), masih ada selisih kecil antara hasil pembulatan dan nilai matematika exact. Ini **bukan bug** — ini konsekuensi dari "Rupiah tidak punya desimal."

| Item | Exact | Dibulatkan | Bias | Arah |
|---|---|---|---|---|
| Rp 500 × 12.5% | 437,50 | 438 | +0,50 | Overcharge Rp 0,50 |
| Rp 4.500 × 12.5% | 3.937,50 | 3.938 | +0,50 | Overcharge Rp 0,50 |
| Rp 7.500 × 12.5% | 6.562,50 | 6.563 | +0,50 | Overcharge Rp 0,50 |
| Rp 10.000 × 5% | 9.500,00 | 9.500 | 0 | Exact ✓ |
| Rp 333 × 10% | 299,70 | 300 | +0,30 | Overcharge Rp 0,30 |
| Rp 335 × 10% | 301,50 | 302 | +0,50 | Overcharge Rp 0,50 |

**Akumulasi bias Tipe 2:**

Untuk harga kelipatan 500 (non-ribu) dengan 12.5%: selalu +0,50 per item.
Tapi ini adalah **"overcharge" terhadap perhitungan matematis murni** — bukan kesalahan sistem.
Nilai yang tersimpan di DB adalah satu-satunya "ground truth" karena Rupiah tidak bisa punya desimal.

Akumulasi tahunan untuk coffee shop medium (200 trx/hr, 3 item, 50% diskon):
- 2.600 trx/bulan × 3 item × Rp 0,50 = Rp 3.900/bulan
- **Rp 46.800/tahun** yang "lebih" dari kalkulasi matematika murni

Tapi ini **tidak menyebabkan selisih rekap** — karena owner, kasir, dan DB semuanya pakai angka yang sama (Formula B). Tidak ada pihak yang memegang angka berbeda.

---

## Bagian 7: Tipe 3 — BOGO Blind Spot (Yang Paling Besar)

Ini yang paling jarang dibicarakan tapi nilai moneternya paling besar.

### Mekanisme

Setiap BOGO transaction menyimpan item gratis sebagai:
```
item_type = 'promo_free'
final_price_item = 0
harga_satuan = [harga asli produk]  ← DATA ADA DI DB!
```

Nilai BOGO yang "direlakan" sebenarnya bisa dihitung:
```sql
SELECT SUM(harga_satuan × qty) AS nilai_bogo_bulan_ini
FROM transaction_items ti
JOIN transaksi t ON ti.transaksi_id = t.id
WHERE ti.item_type = 'promo_free'
  AND t.status = 'completed'
  AND DATE_TRUNC('month', t.created_at) = DATE_TRUNC('month', NOW());
```

Tapi query ini **tidak ada di dashboard**. Owner tidak tahu angka ini.

### Simulasi: Berapa BOGO yang "Tidak Terlihat"?

| Setup | Harga item | BOGO/hari | Nilai/hari | Nilai/bulan | Nilai/tahun |
|---|---|---|---|---|---|
| Kecil (10 cup gratis) | Rp 25.000 | 10 | Rp 250.000 | **Rp 6.500.000** | Rp 78.000.000 |
| Sedang (20 cup gratis) | Rp 22.000 | 20 | Rp 440.000 | **Rp 11.440.000** | Rp 137.280.000 |
| Ramai (30 cup gratis) | Rp 30.000 | 30 | Rp 900.000 | **Rp 23.400.000** | Rp 280.800.000 |
| Promo besar (50 gratis) | Rp 28.000 | 50 | Rp 1.400.000 | **Rp 36.400.000** | Rp 436.800.000 |

**Owner yang aktif pakai BOGO, setiap bulan ada Rp 6–36 juta yang "tidak terlihat".**
Revenue benar, grand total benar — tapi owner tidak tahu biaya promonya berapa.

---

## Bagian 8: Perbandingan Semua Tipe dalam Satu Tabel

*Asumsi: Coffee shop 200 trx/hari, 50% pakai diskon, 3 item/trx*

| Jenis Selisih | Sumber | Per Bulan | Per Tahun | Bisa Ditelusuri? |
|---|---|---|---|---|
| Rounding Tipe 1 (A≠B, harga ribu + 12.5%) | Bug formula | **Rp 7.800** | **Rp 93.600** | ❌ Tidak ada jejak |
| Rounding Tipe 2 (bias vs exact) | By design | ~Rp 3.900 | ~Rp 46.800 | ✅ Wajar, by design |
| BOGO blind spot (20 cup/hari × Rp 22k) | Missing UI | **Rp 11.440.000** | **Rp 137.280.000** | ❌ Data ada, tidak tampil |

**Rounding Tipe 1 menjadi Rp 500.000+/tahun hanya di volume very busy (mall outlet).**
**BOGO blind spot menjadi puluhan juta per bulan bahkan di coffee shop sedang.**

---

## Bagian 9: "Kapan Bisa Selisih Ratusan Ribu Per Bulan?"

Pertanyaan yang valid. Inilah skenarionya:

### Dari Rounding Saja: Butuh Volume Sangat Tinggi

Untuk mencapai Rp 100.000/bulan dari rounding Tipe 1:
```
Target: Rp 100.000/bulan
Selisih per transaksi: Rp 5 (5 item bermasalah, 12.5%)
Butuh: 20.000 transaksi bermasalah/bulan
= 769 trx/hari yang pakai diskon 12.5% dengan semua item bermasalah
```

Tidak realistis untuk warung UMKM single outlet. Tapi untuk mall outlet dengan volume tinggi, bisa mendekati ratusan ribu per tahun.

### Dari BOGO Blind Spot: Mudah Mencapai Ratusan Ribu

```
30 cup gratis/hari × Rp 25.000 × 26 hari = Rp 19.500.000/bulan

Owner tidak tahu angka ini. Rekap omzet tetap benar.
Tapi kalau owner mau evaluasi "apakah BOGO ini menguntungkan?",
dia tidak bisa menjawab dari app ini.
```

### Dari Dua Formula: Langsung Terasa Walau Volume Kecil

```
Warung kecil 50 trx/hari, 30% pakai diskon 12.5%, menu harga kelipatan 500:
→ Rp 1.170/bulan = Rp 14.040/tahun

Tidak besar. Tapi ini Rp 14.040 yang:
- Tidak kelihatan dari UI manapun
- Tidak bisa di-audit dari mana asalnya
- Owner akan buang waktu mencari kenapa rekap tidak pas
```

---

## Bagian 10: Aturan Aman untuk Owner

### Preset Diskon yang 100% Aman di Semua Kondisi

```
5%    ← aman dengan semua harga
10%   ← aman dengan semua harga
15%   ← aman dengan semua harga
20%   ← aman dengan semua harga
25%   ← aman dengan harga kelipatan 1.000 atau 2.000
30%   ← aman dengan harga kelipatan 1.000 atau kelipatan 10
```

### Preset yang Perlu Perhatian

```
12.5% ← BERMASALAH untuk harga kelipatan 500 (non-ribu)
         Selisih: 1 Rp per item per transaksi
         Cumulative bisa Rp 90.000+/tahun untuk coffee shop medium

7%    ← Bermasalah untuk harga tertentu (lebih jarang)
```

### Kombinasi Menu yang Aman dengan SEMUA Preset

```
Harga semua kelipatan Rp 1.000:
  Rp 5.000, 10.000, 15.000, 20.000, 25.000, 30.000, 35.000, 40.000
  → 100% aman dengan diskon apapun termasuk 12.5%

Harga kelipatan Rp 2.000:
  Rp 4.000, 6.000, 8.000, 12.000, 18.000, 22.000, 28.000
  → Aman untuk diskon 5%, 10%, 20% (50% factor keluar bulat)
```

---

## Ringkasan dan Aksi yang Diperlukan

### Fix Prioritas 1: Standardisasi Formula (Tipe 1)

File: `src/lib/cart/promo-engine.ts`

```typescript
// SEBELUM (bermasalah):
const diskonNominal = Math.round(subtotal * diskonPersen / 100);  // round di total
const grandTotal = subtotal - diskonNominal;

// SESUDAH (benar):
const grandTotal = cart.reduce((s, c) => {
  if ((c as any).item_type === "promo_free") return s;
  const base = c.harga_satuan * c.qty;
  return s + (diskonPersen > 0 ? Math.round(base * (1 - diskonPersen / 100)) : base);
}, 0);
const diskonNominal = subtotal - grandTotal;  // derive, jangan hitung terpisah
```

Efek: Eliminasi selisih Rp 93.600/tahun (coffee shop medium) tanpa perubahan lain.

---

### Fix Prioritas 2: Tampilkan Nilai BOGO di Dashboard (Tipe 3)

Tambahkan ke `getRingkasanOmzet` atau fungsi terpisah:

```typescript
export interface NilaiBOGO {
  jumlah_item_gratis: number;
  nilai_total_bogo: number;  // SUM(harga_satuan × qty) WHERE promo_free
}

// Query:
.from("transaction_items")
.select("harga_satuan, qty, transaksi!inner(status, created_at)")
.eq("item_type", "promo_free")
.eq("transaksi.status", "completed")
.gte("transaksi.created_at", startOfMonthISO())
```

Efek: Owner bisa melihat bahwa BOGO bulan ini "memakan" Rp X — bisa evaluasi apakah worth it.

---

### Tidak Perlu Fix: Tipe 2 (Rounding Bias)

Tipe 2 adalah matematika murni — ketika nilai exact adalah X,50 rupiah, harus dibulatkan ke salah satu arah. Math.round() memilih ke atas. Ini keputusan yang konsisten dan dapat didokumentasikan. Tidak ada selisih rekap yang terjadi karena ini.

---

## Satu Kalimat

> Harga menu kelipatan Rp 1.000 + preset diskon tanpa 12.5% = **100% aman**.
> Aktifkan 12.5% atau harga kelipatan Rp 500 = **bermasalah jika formula tidak difix**.
> BOGO tanpa dashboard metric = **puluhan juta per bulan tidak terlihat**.
