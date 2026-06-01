# CHANGES — apa yang berubah di file LAMA

Semua file di bawah disertakan **utuh** di bundle; ini cuma ringkasan biar gampang di-diff.

| File | Perubahan |
|------|-----------|
| `src/lib/config/features.ts` | Pola **tier** (v1=1, v2=2, v3=3). Flag lama (payment/refund/promoEngine/promoManagement) jadi `tier>=2`. Tambah `qrisPayment` & `pgConnector` = `tier>=3`. V3 = superset V2. |
| `src/proxy.ts` | `PUBLIC_PATHS` ditambah `"/api/payment/webhook"` (webhook PG tanpa cookie). `/create`, `/status`, `/credentials*` tetap di belakang cookie. |
| `src/lib/db/transaksi.ts` | Ekstrak fungsi murni **`buildTransaksiPayload()`** (logika BOGO + pairing `triggered_by_item_id` + grand_total) dari `simpanTransaksi`; `simpanTransaksi` kini memanggilnya. Export tipe `ItemInsertRow`, `TrxInsertRow`, `BuildTransaksiArgs`. **Semua fungsi lain (void/refund/riwayat/dashboard) tidak berubah.** Insert tetap batch-satu-statement (deferred trigger). |
| `src/hooks/use-kasir-data.ts` | `useKasirData` tambah state **`pgReady`** (fetch `GET /api/payment/credentials` saat `features.qrisPayment`, true bila ada credential `is_active`) dan mengembalikannya. `useCart`/`useBayar` tidak berubah. |
| `src/components/kasir/kasir-view.tsx` | Tambah `usePaymentSession` + `QrisDialog` + state `qrisOpen`. `handleBayar` bercabang: QRIS-via-PG → `pay.create(...)` + buka dialog (skip `bayar()`); selain itu jalur cash lama. Effect saat `paid` → tampil struk, reset cart, `pay.reset()`. Pass `qrisPgReady` ke `CartPanel`. |
| `src/components/kasir/cart-panel.tsx` | `CartPanelProps` + `qrisPgReady?`. `PanelBody` hitung `autoQris = qrisPgReady && qrisPayment && method==='qris'`, diteruskan ke `PaymentMethodPicker` & `CartSummary`. `canBayar` non-cash tidak berubah. |
| `src/components/kasir/payment-method.tsx` | Prop opsional `autoQris`; teks metode QRIS jadi "QR dibuat otomatis saat Bayar". |
| `src/components/kasir/cart-summary.tsx` | Prop opsional `autoQris`; label tombol jadi "Bayar via QRIS · RpX". |
| `src/components/pengaturan/pengaturan-view.tsx` | Tambah Card **"Pembayaran QRIS"** dengan NavLink ke `/pengaturan/pembayaran`, gated `features.pgConnector`. |

Tidak diubah & tidak disertakan: `src/store/cart-store.ts` (sesi QRIS hidup di hook).
