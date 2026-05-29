# POS UMKM — Proposal Produk
> "Bayar sekali, pakai selamanya. Tanpa internet, tanpa drama."
> Versi dokumen: 1.0 · 2026-05-29

---

## Daftar Isi

1. [Latar Belakang](#1-latar-belakang)
2. [Permasalahan yang Ditemukan](#2-permasalahan-yang-ditemukan)
3. [Kenapa UMKM Butuh Ini Sekarang](#3-kenapa-umkm-butuh-ini-sekarang)
4. [Visi Produk](#4-visi-produk)
5. [Target Pengguna](#5-target-pengguna)
6. [Scope yang Disepakati](#6-scope-yang-disepakati)
7. [Keputusan Produk dan Alasannya](#7-keputusan-produk-dan-alasannya)
8. [Roadmap V1 dan V2](#8-roadmap-v1-dan-v2)
9. [Arsitektur Teknis Ringkas](#9-arsitektur-teknis-ringkas)
10. [Alur Aktivasi dan Distribusi](#10-alur-aktivasi-dan-distribusi)
11. [Known Limitations yang Diterima](#11-known-limitations-yang-diterima)
12. [Definisi Selesai](#12-definisi-selesai)

---

## 1. Latar Belakang

Mayoritas POS yang ada di pasaran punya satu atau lebih dari masalah berikut: berbayar bulanan yang memberatkan, butuh internet stabil untuk setiap transaksi, terlalu kompleks untuk kebutuhan warung atau coffee shop kecil, atau sebaliknya terlalu sederhana sampai tidak bisa bikin rekap yang bisa dipercaya.

UMKM tidak butuh fitur enterprise. Mereka butuh satu hal: **angka rekap yang bisa dipercaya setiap akhir bulan.**

Dokumen ini adalah dasar dari produk POS UMKM — sebuah aplikasi kasir offline-first yang didistribusikan lewat kode aktivasi dengan model bayar sekali.

---

## 2. Permasalahan yang Ditemukan

Permasalahan ini bukan asumsi. Ini hasil analisis jujur dari skema POS generik yang ada, diuji dengan skenario nyata operasional coffee shop.

### 2.1 Rekap tidak bisa dipercaya

Angka di aplikasi tidak bisa dicocokkan dengan kas fisik. Tidak ada catatan metode bayar (tunai vs QRIS), sehingga owner tidak bisa verifikasi apakah uang di laci sesuai dengan yang tercatat.

Contoh nyata: total transaksi hari ini Rp 2.300.000 tapi kas fisik hanya Rp 900.000 karena sisanya QRIS. Tanpa kolom `payment_method`, dua angka ini tidak bisa direkonsiliasi.

### 2.2 Rounding tidak didefinisikan, selisih 1 rupiah bisa terakumulasi

7% dari Rp 13.333 = Rp 933.31. Kalau UI bulatkan ke bawah tapi server bulatkan ke atas, selisihnya 1 rupiah per item. Kali 200 transaksi sehari = Rp 200 per hari. Kali 30 hari = **Rp 6.000 per bulan** rekap tidak cocok dengan kas tanpa ada yang tahu penyebabnya.

### 2.3 Hard delete merusak riwayat transaksi

Saat owner menghapus item dari menu, semua transaksi lama yang mengandung item tersebut kehilangan referensinya. Riwayat rusak diam-diam.

### 2.4 Grand total tidak di-enforce

Tidak ada mekanisme yang memastikan `grand_total` di header transaksi sama dengan `SUM(final_price_item)` di baris item. Developer bisa salah kalkulasi dan tidak ada yang tahu.

### 2.5 Diskon tidak bisa diaudit

Diskon disimpan sebagai angka persen di header, tanpa referensi ke preset mana yang dipakai. Tidak ada jejak: "diskon ini dari preset apa, siapa yang buat, kapan berlakunya."

### 2.6 Promo BOGO tidak punya struktur data

Item gratis dari promo tidak dicatat sebagai entitas tersendiri. Nilai promo BOGO tidak bisa dihitung, tidak bisa masuk laporan, tidak bisa diaudit.

### 2.7 Status transaksi tidak ada

Void = hard delete. Data hilang. Tidak ada trail siapa yang void, kapan, dan kenapa.

---

## 3. Kenapa UMKM Butuh Ini Sekarang

### Mereka sudah ada yang butuh solusi

Coffee shop UMKM beroperasi setiap hari. Mereka mencatat manual, atau pakai aplikasi yang angkanya tidak bisa dipercaya, atau pakai spreadsheet yang error-prone.

### Masalah 1 rupiah itu nyata

Bukan soal nominal. Ini soal kepercayaan terhadap sistem. Kalau rekap sering meleset meskipun sedikit, owner tidak akan percaya sistemnya — dan akhirnya balik ke pencatatan manual.

### Model bisnis yang cocok untuk UMKM

Langganan bulanan memberatkan UMKM dengan pendapatan tidak konsisten. Model bayar sekali, dapat selamanya, cocok dengan cara pikir mereka. Investasi satu kali, pakai terus.

### Offline-first adalah keharusan, bukan fitur

Internet di banyak lokasi UMKM tidak stabil. POS yang bergantung pada koneksi akan mati di saat yang paling kritis: peak hour transaksi.

### Payment gateway bukan kebutuhan sekarang

QRIS di aplikasi ini bukan melalui payment gateway seperti Midtrans. Kasir konfirmasi secara manual bahwa pembayaran QRIS sudah diterima. Ini cukup untuk UMKM yang tidak punya kebutuhan settlement otomatis.

---

## 4. Visi Produk

**POS UMKM adalah alat yang membuat owner coffee shop bisa tidur nyenyak.**

Bukan karena semua masalah bisnis selesai, tapi karena satu hal yang seharusnya pasti — angka rekap — memang bisa dipercaya.

Produk ini bukan untuk scaling, bukan untuk enterprise, bukan untuk franchise. Produk ini untuk satu outlet, satu kasir, satu owner yang ingin tahu berapa omzetnya hari ini tanpa harus khawatir sistemnya berbohong.

---

## 5. Target Pengguna

**Primer:** Owner coffee shop atau warung kopi UMKM, single outlet.

Karakteristik:
- Omzet harian Rp 500.000 — Rp 5.000.000
- 1-2 orang yang pegang operasional
- Tidak punya IT support, tidak punya akuntansi formal
- Pegang HP Android sendiri sebagai perangkat utama
- Sudah pakai QRIS bank untuk menerima pembayaran non-tunai
- Tidak pernah dan tidak akan punya payment gateway

**Sekunder (V2):** Owner yang mulai hire kasir — butuh tracking siapa yang melakukan transaksi mana.

---

## 6. Scope yang Disepakati

### Masuk scope

- Manajemen menu: tambah, edit, nonaktifkan (soft delete), toggle ketersediaan harian
- Kategori menu
- Transaksi kasir: pilih item, pilih diskon dari preset, bayar
- Payment method: Tunai (dengan kembalian), QRIS, Transfer Bank, Debit (konfirmasi manual)
- Diskon dari preset yang dibuat owner — kasir tidak bisa input angka bebas
- Promo BOGO otomatis (V2): beli 1 gratis 1, beli 2 gratis 1
- Void transaksi oleh owner (V1), ditambah Refund (V2)
- Dashboard: omzet hari ini, minggu ini, bulan ini, chart 7 hari, top produk
- Export laporan Excel + backup data
- Import restore dari file backup
- Cetak struk ke thermal printer bluetooth
- Aktivasi via kode yang didistribusikan owner/developer

### Keluar scope (eksplisit)

- Payment gateway (Midtrans, Xendit, dll)
- Settlement otomatis QRIS
- Multi-outlet
- Inventory management / stok quantity
- Manajemen pegawai / penggajian
- Pajak (PPN)
- Split bill
- Loyalty points / member card
- Integrasi akuntansi (Jurnal, Accurate)

---

## 7. Keputusan Produk dan Alasannya

Setiap keputusan di sini pernah dipertanyakan selama sesi perancangan. Berikut keputusan yang diambil dan alasan spesifiknya.

---

### 7.1 Kasir tidak bisa input diskon bebas

**Keputusan:** Kasir hanya bisa memilih dari preset diskon yang dibuat oleh owner. Tidak ada field input angka.

**Alasan:** Kalau kasir bisa input diskon bebas, tidak ada cara untuk mengaudit dari mana diskon itu berasal. Preset wajib dipilih artinya setiap diskon punya referensi ke `diskon_preset_id` — bisa di-trace siapa yang buat preset, kapan, berapa persen. Ini bukan soal tidak percaya kasir; ini soal integritas data audit.

---

### 7.2 Grand total dihitung server, bukan dari UI

**Keputusan:** UI tidak pernah mengirim `grand_total` ke server. Server menghitung ulang dari item-item yang dikirim.

**Alasan:** Kalau grand total dikirim dari UI, developer bisa salah kalkulasi dan tidak ada yang mendeteksi. Dengan server yang hitung ulang, ada lapisan verifikasi kedua sebelum data masuk database. Di sisi database, trigger `check_grand_total` memvalidasi `SUM(final_price_item) == grand_total` sebagai lapisan ketiga.

---

### 7.3 Satu aturan rounding, ditulis di tiga tempat

**Keputusan:** `final_price_item = ROUND(harga_satuan × qty × (1 - persen/100), 0)` dengan round half up. Kalikan dulu, baru bulatkan. Ditulis di dokumen arsitektur, di komentar kode, dan di unit test.

**Alasan:** Rounding yang tidak konsisten adalah penyebab selisih 1 rupiah yang paling sering tidak terdeteksi. Dengan satu formula yang ditulis eksplisit dan ditest, tidak ada ruang untuk interpretasi berbeda antara UI dan server.

---

### 7.4 Tidak pernah hard delete

**Keputusan:** Semua operasi "hapus" di UI mengubah `is_active = FALSE`. Data tidak pernah dihapus dari database.

**Alasan:** Riwayat transaksi merujuk ke `menu_item_id`. Kalau item dihapus, riwayat rusak. Soft delete memastikan integritas historis selamanya — owner bisa hapus item dari tampilan tanpa merusak laporan bulan lalu.

---

### 7.5 Void, bukan hapus — dan refund dibedakan dari void

**Keputusan:** Transaksi yang salah di-void (status berubah ke `void`), tidak dihapus. Di V2 ditambah opsi refund (status `refund`) sebagai kategori terpisah.

**Alasan:** Void dan refund punya semantik berbeda dalam pembukuan. Void: transaksi dibatalkan sebelum atau saat barang/jasa diserahkan. Refund: pembeli sudah bayar dan sudah menerima, tapi kemudian dikembalikan. Keduanya tidak masuk rekap revenue, tapi masing-masing punya trail audit yang berbeda.

---

### 7.6 BOGO terpicu otomatis, kasir tidak perlu tahu

**Keputusan:** Saat kasir pilih item yang punya promo rule aktif, item gratis otomatis masuk keranjang tanpa aksi kasir.

**Alasan:** Kalau kasir harus tahu dan aktif pilih promo, ada risiko lupa — pelanggan tidak dapat haknya, kepercayaan rusak. Otomatis berarti konsisten. Kasir tidak bisa "sengaja tidak terapkan" promo yang seharusnya berlaku.

---

### 7.7 Item promo_free tidak kena diskon header

**Keputusan:** Item dengan `item_type = promo_free` tidak pernah kena diskon dari header transaksi. `final_price_item = 0`, `diskon_persen = 0` dipaksa di server sebelum INSERT.

**Alasan:** Ini skenario chaos yang nyata — pelanggan pesan BOGO, kasir tap diskon 10%, item gratis kena diskon dari harga 0 — rekap biaya promo jadi dobel. Dengan enforce di server, tidak ada kemungkinan interpretasi.

---

### 7.8 Payment method disimpan, bukan hanya grand total

**Keputusan:** Setiap transaksi menyimpan `payment_method` (tunai/qris/transfer/debit), `uang_diterima`, dan `kembalian` untuk transaksi tunai.

**Alasan:** Rekonsiliasi kas fisik hanya bisa dilakukan kalau ada catatan dari mana uang berasal. `SUM(uang_diterima) - SUM(kembalian)` dari transaksi tunai harus sama dengan uang yang ada di laci kasir. Tanpa ini, omzet bisa benar tapi uang fisik tidak cocok dan tidak ada yang tahu kenapa.

---

### 7.9 nomor_order format YYYYMMDD-XXXX, bukan sequential

**Keputusan:** `nomor_order = '20250529-0042'` — tanggal plus nomor urut per hari, reset setiap hari.

**Alasan:** Format ini mudah dibaca manusia, bisa diverifikasi tanpa akses database (customer bisa sebut nomor order), dan uniqueness dijaga dengan `UNIQUE(umkm_id, nomor_order)` di database. Kalau ada duplikasi concurrent (diakui sebagai known limitation untuk single kasir), format ini memudahkan investigasi.

---

### 7.10 Snapshot harga adalah kontrak permanen

**Keputusan:** `transaction_items.harga_satuan` dan `transaction_items.nama_produk` adalah snapshot saat transaksi terjadi — immutable setelah INSERT.

**Alasan:** Harga menu berubah. Nama produk bisa di-rename. Kalau laporan lama mengambil harga dari `menu_item.harga` yang sudah berubah, laporan lama akan berubah nilainya retroaktif. Snapshot di transaction_items memastikan laporan bulan lalu selalu sama, kapanpun dibuka.

---

### 7.11 Offline-first, Supabase hanya untuk aktivasi sekali

**Keputusan:** Semua data operasional disimpan di SQLite lokal. Supabase hanya diakses sekali untuk validasi kode aktivasi, setelah itu aplikasi tidak pernah lagi butuh internet untuk fungsi apapun.

**Alasan:** Internet tidak stabil di banyak lokasi UMKM. POS yang bergantung cloud akan mati di peak hour — tepat saat paling dibutuhkan. Offline-first bukan fitur tambahan, ini syarat utama untuk produk ini bisa dipercaya.

---

### 7.12 Model bayar sekali

**Keputusan:** Produk didistribusikan via kode aktivasi. Tidak ada langganan bulanan.

**Alasan:** UMKM memiliki pendapatan yang tidak konsisten bulan ke bulan. Langganan bulanan jadi beban psikologis dan finansial — terutama di bulan-bulan sepi. Model bayar sekali membuat komitmen adopsi lebih mudah dan menghilangkan kecemasan "harus bayar lagi bulan depan."

---

## 8. Roadmap V1 dan V2

### V1 — Owner-Only POS

**Definisi:** Satu UMKM, satu perangkat, satu orang yang pegang semuanya. Tidak ada login, tidak ada role separation.

**Yang bisa dilakukan:**
- Kelola menu (tambah, edit, soft delete, toggle ketersediaan)
- Terima bayaran: Tunai (dengan kembalian) dan QRIS
- Pilih diskon dari preset — tidak ada input bebas
- Simpan transaksi dengan `nomor_order` format YYYYMMDD-XXXX
- Void transaksi yang salah (bukan hapus)
- Lihat riwayat transaksi dengan status badge (Lunas / Void)
- Dashboard omzet hari ini, minggu ini, bulan ini — hanya dari transaksi `completed`
- Export laporan Excel + backup data
- Restore dari file backup

**Yang belum ada di V1:**
- Promo BOGO
- Transfer Bank dan Debit sebagai payment method
- Refund (hanya void)
- Multi-user / role kasir terpisah

**Deliverable V1:**
- `expo-pos-umkm-v1.zip` — 17 file, siap replace ke project Expo

---

### V2 — Promo + Payment Lengkap + Refund

**Definisi:** Di atas V1 yang sudah jalan. Tidak ada perubahan stack, tidak ada dependency baru.

**Yang ditambahkan:**
- Promo BOGO dan Buy2Get1 — otomatis terpicu, kasir tidak perlu tahu
- Payment method: + Transfer Bank, + Kartu Debit
- Refund sebagai kategori terpisah dari Void
- Card nilai promo BOGO bulan ini di dashboard
- Laporan Excel mencantumkan item GRATIS dan nilai promo yang direlakan
- Struk menampilkan "GRATIS (BOGO)" — bukan "Rp 0" tanpa keterangan

**Cara apply V2:** Extract zip, copy isi folder ke project di atas V1 — merge/replace. Tidak perlu install dependency baru. Database migration idempotent — data V1 tetap aman.

**Deliverable V2:**
- `expo-pos-umkm-v2.zip` — 12 file, replace di atas V1

---

### Tabel Perbandingan V1 vs V2

| Fitur | V1 | V2 |
|---|---|---|
| Promo BOGO otomatis | ❌ | ✅ |
| item_type promo_free | ❌ | ✅ |
| Transfer + Debit | ❌ | ✅ |
| Refund | ❌ | ✅ |
| Void | ✅ | ✅ |
| Diskon dari preset | ✅ | ✅ |
| Dashboard nilai promo | ❌ | ✅ |
| Laporan Excel promo | ❌ | ✅ |
| Export/Import Excel | ✅ | ✅ |
| Cetak struk bluetooth | ✅ | ✅ |
| Offline full | ✅ | ✅ |
| Multi-user / kasir terpisah | ❌ | ❌ (V3) |
| Auto-reset is_available harian | ❌ | ❌ (V3) |

---

## 9. Arsitektur Teknis Ringkas

### Stack Mobile (Expo)

- **Runtime:** Expo SDK 56, React Native 0.81.4
- **Database:** expo-sqlite — semua data lokal, offline sepenuhnya
- **Aktivasi:** Supabase (hanya sekali saat aktivasi kode)
- **Export:** SheetJS — Excel di device tanpa server
- **Printer:** react-native-bluetooth-escpos-printer — thermal Bluetooth
- **Routing:** expo-router (file-based)

### Rantai Kepercayaan Data

```
menu_item.harga
    ↓ (snapshot saat item masuk keranjang)
transaction_items.harga_satuan     ← immutable setelah INSERT
    ↓
transaction_items.item_type        ← normal | discounted | promo_free
    ↓
transaction_items.diskon_persen    ← dari preset, bukan dari UI
transaction_items.diskon_preset_id ← referensi ke preset yang dipakai
    ↓
transaction_items.final_price_item ← dihitung server, bukan dari UI
    ↓
transaksi.grand_total              ← HARUS == SUM(final_price_item)
                                      dihitung server
```

Kalau satu mata rantai putus — rekap tidak bisa dipercaya.

### Formula yang Tidak Boleh Berubah

```
final_price_item = ROUND(harga_satuan × qty × (1 - diskon_persen / 100), 0)

Aturan: kalikan dulu, bulatkan sekali di akhir
Round: half up (bukan banker's rounding)
```

```
qty_gratis = FLOOR(qty_dipesan / (qty_beli + qty_gratis)) × qty_gratis
qty_bayar  = qty_dipesan - qty_gratis
```

Kedua formula ini ditulis di tiga tempat: dokumen ini, komentar kode, unit test.

### Tabel Database Kunci

| Tabel | Fungsi |
|---|---|
| `umkm_config` | Profil UMKM, status aktivasi |
| `kategori` | Kategori menu, soft delete |
| `menu_item` | Menu, harga, `is_active`, `is_available` |
| `diskon_preset` | Preset diskon yang bisa dipilih kasir |
| `promo_rule` | Rule BOGO/Buy2Get1 per item (V2) |
| `transaksi` | Header transaksi, payment, void trail |
| `transaction_items` | Snapshot item per transaksi, immutable |

---

## 10. Alur Aktivasi dan Distribusi

```
Developer/Penjual
    ↓ generate kode di Supabase dashboard
Kode (format: XXXX-XXXX-XXXX)
    ↓ kirim via WhatsApp ke pembeli
Owner UMKM
    ↓ buka aplikasi pertama kali
Step 1: Input kode aktivasi (butuh internet, hanya sekali)
    ↓ aplikasi verifikasi ke Supabase
    ↓ kode valid → set activated = 1 di SQLite lokal
    ↓ seed 4 preset diskon default (5%, 10%, 15%, 20%)
Step 2: Isi profil UMKM (nama, alamat, footer struk)
    ↓
Aplikasi siap, tidak butuh internet lagi selamanya
```

**Re-aktivasi device yang sama:** Kode yang sama bisa dipakai di device yang sama (misal HP baru dari device ID yang sama atau re-install). Tidak bisa dipakai di device berbeda.

---

## 11. Known Limitations yang Diterima

Ini bukan bug yang tidak disadari. Ini lubang yang disadari, terdokumentasi, dan secara eksplisit diserahkan ke application layer atau diterima sebagai trade-off.

### KL-01: Overlap promo aktif tidak dicegah di database

`UNIQUE(menu_item_id, tipe_promo)` mencegah duplikasi tipe yang sama, tapi tidak mencegah overlap periode. Application layer yang harus cek sebelum INSERT promo baru.

### KL-02: is_available tidak ada auto-reset harian

Kasir yang lupa toggle balik setelah stok datang akan membuat item tidak muncul berhari-hari. Untuk V1 dan V2, ini manual. Auto-reset masuk backlog V3.

### KL-03: generate_nomor_order tidak atomic untuk multi-kasir

`SELECT MAX + 1` aman untuk single kasir. Kalau ada dua kasir concurrent, bisa duplikat. Harus diganti ke sequence atau `SELECT FOR UPDATE` sebelum ada kasir kedua.

### KL-04: triggered_by_item_id dijaga logika, bukan FK constraint

Integritas `triggered_by_item_id` dijaga oleh promo engine (sequential INSERT). Operasi bulk yang bypass application layer bisa melanggar integritas ini.

### KL-05: Import restore tanpa validasi bisnis penuh

Import dari Excel hanya restore data apa adanya. Tidak ada validasi apakah `grand_total` yang di-restore konsisten dengan item-itemnya. Dianggap cukup karena file backup berasal dari export yang sudah valid.

---

## 12. Definisi Selesai

Produk dianggap siap dipakai ketika semua kondisi berikut terpenuhi.

### V1 selesai ketika:

- Owner bisa tambah, edit, soft-delete menu tanpa merusak riwayat transaksi
- Kasir hanya bisa pilih diskon dari preset — tidak ada field input angka
- Transaksi tunai menyimpan uang diterima dan kembalian
- Transaksi QRIS tersimpan tanpa input uang diterima
- `nomor_order` keluar format YYYYMMDD-XXXX, tidak pernah duplikat dalam sehari
- Owner bisa void transaksi yang salah — data tidak hilang, hanya status berubah
- Dashboard omzet **hanya** menghitung transaksi `status = completed`
- Export Excel bisa didownload dan di-restore dengan benar ke device baru
- Riwayat transaksi void ditampilkan dengan badge berbeda dari completed
- Unit test formula rounding lulus: `ROUND(harga × qty × (1 - persen/100), 0)` menghasilkan nilai yang sama di semua test case

### V2 selesai ketika:

- Item BOGO otomatis masuk keranjang saat owner pilih produk yang punya rule aktif
- Item `promo_free` tidak pernah kena diskon header — `final_price_item = 0` dipaksa
- Struk menampilkan "GRATIS (BOGO)" — bukan "Rp 0"
- Refund bisa dilakukan terpisah dari void, dengan alasan yang tersimpan
- Transfer dan Debit tersedia sebagai payment method
- Dashboard menampilkan card nilai promo BOGO bulan ini
- Export Excel mencantumkan item GRATIS dan total nilai promo di summary
- Import restore berhasil: `triggered_by_item_id` dipetakan ke rowid baru yang tepat

### Tidak pernah dianggap selesai kalau:

- Ada hard delete di manapun (menu, transaksi, preset)
- `grand_total` diambil dari UI tanpa kalkulasi ulang di server
- Kasir bisa input diskon angka bebas
- Query rekap tidak memfilter `status = completed`
- Formula rounding berbeda antara preview di UI dengan nilai yang tersimpan di database

---

> **Catatan Akhir**
>
> Produk ini dibangun dari satu keyakinan sederhana:
> owner coffee shop yang bekerja keras dari pagi sampai malam
> berhak mendapat rekap yang bisa dipercaya — bahkan sampai 1 rupiah terakhir.
>
> Bukan karena 1 rupiah itu nilainya besar.
> Tapi karena kalau 1 rupiah saja tidak bisa dipercaya,
> tidak ada alasan untuk percaya angka lainnya.
