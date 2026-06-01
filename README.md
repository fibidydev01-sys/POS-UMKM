# POS UMKM — V3 Payment (QRIS) · Drop-in Bundle

Connector QRIS multi–payment-gateway (**Xendit · Midtrans · DOKU**) dengan adapter
pattern. App = connector, **bukan** merchant: tiap tenant colok kredensial PG **milik
mereka sendiri**. **QRIS only** (R1). Cash flow **tidak berubah**.

Semua file di bundle ini adalah **versi utuh** dari source-mu (file baru + file lama yang
sudah ku-edit) — tinggal **copy `src/` menimpa `src/` proyekmu**. Tidak ada lagi patch
manual. Lihat `CHANGES.md` untuk daftar persis apa yang berubah di tiap file lama.

Adapter PG sudah ku-cocokkan dengan **dokumentasi resmi terkini** (Xendit QR Codes v2,
Midtrans Core API charge QRIS, DOKU SNAP QRIS MPM).

---

## Pasang (urut)

1. **Dependency QR**
   ```bash
   npm i qrcode.react
   ```

2. **Environment** (`.env`)
   ```bash
   NEXT_PUBLIC_POS_VERSION=v3                 # v3 = superset v2 + QRIS
   PG_ENCRYPTION_KEY=<base64 32 byte acak>    # SERVER ONLY — jangan NEXT_PUBLIC_
   #   generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   # (sudah ada) NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Migrasi DB** — jalankan `migrations/001_v3_payment.sql` di Supabase SQL editor.

4. **Copy file** — salin seluruh `src/` bundle ke `src/` proyek (timpa file lama).

5. **Webhook URL** — daftarkan di dashboard PG tiap tenant (per provider):
   ```
   https://<domain-app>/api/payment/webhook/xendit
   https://<domain-app>/api/payment/webhook/midtrans
   https://<domain-app>/api/payment/webhook/doku
   ```

6. **Setup di app** — `Pengaturan → Pembayaran QRIS → Setup Gateway`: pilih provider,
   isi key, **Test Connection**, **Simpan & Aktifkan**. Mulai dari `mode = sandbox`.

---

## Yang ada di bundle

### File BARU
```
src/lib/payment/types.ts                          kontrak PGAdapter + tipe
src/lib/payment/crypto.ts                          AES-256-GCM (server-only)
src/lib/payment/xendit.ts                          adapter Xendit (QR Codes v2)
src/lib/payment/midtrans.ts                        adapter Midtrans (Core API charge)
src/lib/payment/doku.ts                            adapter DOKU (SNAP QRIS MPM)
src/lib/payment/registry.ts                        provider → adapter + peek webhook
src/lib/db/pg-credentials.ts                       vault credentials (enkripsi, server-only)
src/lib/db/payment-session.ts                      CRUD session + snapshot cart + kasir_id
src/app/api/payment/create/route.ts                buat QR (idempotent R6, amount==grand_total)
src/app/api/payment/status/route.ts                polling status + struk (R7)
src/app/api/payment/webhook/[provider]/route.ts    verify (R5) + buat transaksi (R8)
src/app/api/payment/credentials/route.ts           list (tanpa key) + simpan
src/app/api/payment/credentials/test/route.ts      test connection
src/hooks/use-payment-session.ts                   state machine + polling + countdown
src/components/kasir/qris-dialog.tsx               drawer QR + countdown + regenerate
src/components/pengaturan/pg-setup-view.tsx        form setup PG
src/app/pengaturan/pembayaran/page.tsx             halaman setup (gated v3)
migrations/001_v3_payment.sql                      tabel + RLS + idempotency index
```

### File LAMA yang DIEDIT (utuh — timpa langsung)
```
src/lib/config/features.ts                  tier v1/v2/v3 + qrisPayment/pgConnector
src/proxy.ts                                + /api/payment/webhook ke PUBLIC_PATHS
src/lib/db/transaksi.ts                     + buildTransaksiPayload(); simpanTransaksi pakai builder
src/hooks/use-kasir-data.ts                 + pgReady (deteksi PG aktif)
src/components/kasir/kasir-view.tsx         orkestrasi QrisDialog + cabang handleBayar
src/components/kasir/cart-panel.tsx         threading qrisPgReady → autoQris
src/components/kasir/payment-method.tsx     hint metode QRIS
src/components/kasir/cart-summary.tsx       label tombol "Bayar via QRIS"
src/components/pengaturan/pengaturan-view.tsx  NavLink "Setup Gateway QRIS" (gated v3)
```

> `src/store/cart-store.ts` **tidak diubah** (sesi QRIS hidup di hook). Tidak disertakan.

---

## Catatan penting

- **Xendit & Midtrans: siap produksi** (inline QR, cukup 1 key; webhook diverifikasi —
  Xendit `x-callback-token`, Midtrans `signature_key` SHA512). Tetap uji sandbox dulu.

- **DOKU butuh perhatian khusus.** QR inline DOKU hanya dari **SNAP "QRIS MPM Generate"**,
  yang perlu **TIGA rahasia**: Client-Id, Client Secret, dan **RSA private key** (untuk B2B
  token). Di form: `API Key = ClientId:ClientSecret`, `RSA Private Key = base64(PEM)`.
  Mekanika signature sudah sesuai docs (token RSA-SHA256 asimetris; generate & notif
  HMAC-SHA512 simetris), tapi **path endpoint / CHANNEL-ID / merchantId / format minify**
  WAJIB diverifikasi di sandbox DOKU akunmu — ditandai komentar `VERIFIKASI` di `doku.ts`.
  (DOKU Checkout sengaja TIDAK dipakai karena mengembalikan halaman redirect → langgar R1.)

- **Konsistensi nominal:** `create/route.ts` menghitung amount QR pakai
  `buildTransaksiPayload` yang SAMA dengan saat webhook insert transaksi → **nominal yang
  ditagih == `grand_total` tercatat** (tidak ada selisih pembulatan; trigger
  `check_grand_total` aman).

- **R8 (transaksi pasca-bayar):** transaksi dibuat **di webhook** dari `cart_snapshot`
  (browser kasir boleh ketutup), idempoten (insert → klaim `transaksi_id`; pemenang race
  yang simpan, yang kalah dihapus). `nomor_order` digenerate saat paid → sequence rapat.

- **Phase 0 / S1 (prasyarat keamanan):** untuk R3 penuh, pindahkan juga write
  `transaksi`/`transaction_items` ke service-role + RLS dan cabut grant anon. Di luar
  bundle ini (ada contoh di akhir `001_v3_payment.sql`), tapi **wajib sebelum produksi**.

- **Dua flip beda:** `NEXT_PUBLIC_POS_VERSION` (fitur, env) vs `pg_credentials.mode`
  (sandbox/production, per-tenant DB). Jangan ketukar.
