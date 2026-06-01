# QRIS Scan-Pay — Audit & Fix Report (V3)

Tujuan audit: memastikan alur bayar QRIS (scan) **benar-benar berfungsi** dan
**tersambung di setiap komponen**, lalu memperbaikinya.

---

## TEMUAN UTAMA (kenapa "kerasa belum fungsi")

### 1. ⛔ QR tidak ter-render — ketergantungan `qrcode.react` (KRITIS)
`qris-dialog.tsx` meng-`import { QRCodeSVG } from "qrcode.react"`. Kalau paket itu
**tidak ada di `package.json`**, dialog crash / QR kosong begitu dibuka → kasir
melihat layar kosong = "belum fungsi". QRIS dinamis dari PG datang sebagai **string
EMVCo mentah** (`qr_string`) yang HARUS dirender jadi gambar QR agar bisa discan.

**Fix:** Menulis **QR encoder sendiri tanpa dependensi** —
`src/lib/payment/qr-encoder.ts` (byte-mode, auto-version 1–40, Reed–Solomon ECC
L/M/Q/H, mask penalty). Sudah divalidasi: struktur finder/timing/dark-module sesuai
spesifikasi, payload QRIS ~150–330 char ter-encode (versi 9–13). Dialog merender
sebagai SVG inline. Tidak ada lagi paket pihak ketiga yang bisa "hilang".

### 2. ⛔ Kelas Tailwind invalid `h-58 w-58`
Branch fallback `<img>` memakai `h-58 w-58` yang **tidak ada** di skala Tailwind →
ukuran kacau. **Fix:** ganti ke ukuran piksel eksplisit (`width/height={232}`).

### 3. ⚠️ Tidak ada kontrol manual saat webhook telat
Kasir cuma bisa menatap spinner. Di dunia nyata (apalagi **sandbox/localhost** yang
tidak bisa di-reach webhook PG), pembayaran bisa sukses tapi UI menggantung.

**Fix:**
- Tombol **"Cek status pembayaran"** di dialog → `usePaymentSession.checkNow()`
  memaksa polling sekali dengan indikator loading.
- `status` route diberi **fallback `adapter.checkStatus()`**: kalau masih `pending`
  & belum ada transaksi, tanya PG. Kalau PG bilang `expired/failed` → tandai. Kalau
  `paid` → tidak membuat transaksi di sini (R8 tetap di webhook), hanya re-baca
  session supaya kalau webhook baru selesai, struk langsung muncul.

### 4. ⚠️ QRIS bisa dipilih walau gateway belum ada → transaksi manual diam-diam
DoD Fase 6: "Tenant tanpa PG aktif (build v3) → opsi QRIS disembunyikan / diarahkan
ke setup." Sebelumnya: pilih QRIS tanpa PG → tekan Bayar → jatuh ke jalur manual,
tercatat transaksi `qris` **tanpa QR**. Membingungkan.

**Fix:**
- `payment-method.tsx`: kalau build v3 tapi `pgReady=false` & metode `qris`,
  tampilkan kartu peringatan **"Gateway QRIS belum terhubung"** + tombol
  **"Setup Gateway QRIS"** (navigasi ke `/pengaturan/pembayaran`).
- `kasir-view.handleBayar`: kalau v3 + QRIS + belum ready → **blokir**, tampilkan
  toast yang mengarahkan ke setup (tidak lagi diam-diam membuat transaksi manual).

### 5. ➕ Badge provider + nominal + urgensi countdown
Dialog dipoles: nominal besar di header, badge `via XENDIT/MIDTRANS/DOKU`, countdown
berubah merah & berdenyut saat ≤60 detik, tombol **"Salin kode QRIS"** sebagai
fallback. `create` & `status` route sekarang mengembalikan `provider`.

---

## KONEKTIVITAS — diverifikasi tersambung di SEMUA komponen

```
kasir-view ──create()──────────────► usePaymentSession
   │  handleBayar (gated: v3 + qris + pgReady)        │
   │                                                  ├─ POST /api/payment/create ──► getActiveCredential → getAdapter.createQris → createSession
   │                                                  │      (kembalikan sessionId, provider, qr_string, qr_url, expires_at)
   │  ◄──── state/qrString/qrUrl/provider/secondsLeft/error/struk/checking
   │
   ├─ CartPanel ─ qrisPgReady, onSetupGateway ──► PaymentMethodPicker (hint setup bila belum ready)
   │                                              CartSummary (label "Bayar via QRIS")
   │
   └─ QrisDialog ◄── encodeQr/qrMatrixToSvg (render QR), onCheckNow, onRegenerate
            │  poll setiap 2.5s ─► GET /api/payment/status ─► (fallback adapter.checkStatus)
            │       paid + transaksi_id ─► fetchStruk ─► tampil struk, reset, sukses
            ▼
     webhook /api/payment/webhook/[provider] (R5 verify → R8 buat transaksi idempoten)
```

Matriks prop/metode dicek: **semua yang diekspor hook dikonsumsi, semua prop yang
dikirim diterima.** Tidak ada boundary yang putus.

---

## FILE YANG DIUBAH / DITAMBAH

| File | Status | Inti perubahan |
|------|--------|----------------|
| `src/lib/payment/qr-encoder.ts` | **BARU** | QR encoder tanpa dependensi + `qrMatrixToSvg`. |
| `src/components/kasir/qris-dialog.tsx` | rewrite | Render QR in-house, tombol Cek status, copy, badge, urgensi. |
| `src/hooks/use-payment-session.ts` | update | `provider`, `checkNow()`, `checking`. |
| `src/app/api/payment/create/route.ts` | update | Kembalikan `provider`. |
| `src/app/api/payment/status/route.ts` | update | `provider` + fallback `checkStatus`. |
| `src/components/kasir/payment-method.tsx` | update | Hint "gateway belum terhubung" + tombol setup. |
| `src/components/kasir/cart-panel.tsx` | update | Teruskan `pgReady` + `onSetupGateway`; (juga rapikan `DiscountPicker`). |
| `src/components/kasir/kasir-view.tsx` | update | Wire prop baru; blokir manual-QRIS tanpa PG; effect deps benar. |
| `src/components/kasir/discount-picker.tsx` | update | Bersihkan import/prop tak terpakai (lanjutan fix sebelumnya). |
| `src/components/menu/menu-view.tsx` | update | Buang prop `onKelola` invalid (lanjutan fix sebelumnya). |
| `src/components/pengaturan/pengaturan-view.tsx` | update | `variant="accent"` → kelas accent (lanjutan fix sebelumnya). |
| `src/lib/payment/midtrans.ts` | update | Drop param `_headers` tak terpakai (lanjutan fix sebelumnya). |

> Catatan: 5 file terakhir adalah perbaikan error TS/lint dari sesi sebelumnya,
> disertakan lagi agar paket ini konsisten & bisa langsung replace.

---

## CARA PAKAI

1. Extract zip di **root project** (struktur `src/...` dipertahankan) → overwrite.
2. **Tidak perlu** `npm install qrcode.react` lagi — QR sekarang in-house.
3. Pastikan env: `NEXT_PUBLIC_POS_VERSION=v3`, `PG_ENCRYPTION_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
4. Daftarkan webhook di dashboard PG: `https://<domain>/api/payment/webhook/<provider>`.

### Uji cepat (sandbox)
- Pengaturan → Pembayaran → pilih provider, isi key, **Test Connection**, Simpan.
- Kasir → pilih item → metode **QRIS** → **Bayar via QRIS** → QR muncul & **bisa
  discan**. Bayar di sandbox → struk muncul (via webhook atau tombol **Cek status**).
- Tanpa gateway aktif: pilih QRIS → muncul kartu **Setup Gateway**, Bayar diblokir.
- Biarkan lewat TTL → **QR kadaluarsa** + **Buat ulang QR**.
