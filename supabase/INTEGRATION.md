# INTEGRATION — patch untuk file yang SUDAH ADA

> File **baru** sudah lengkap di `src/` (tinggal copy). Dokumen ini berisi perubahan
> untuk file yang **sudah ada** di proyekmu. Gua kasih **potongan tempel** (bukan file
> utuh) supaya kode aslimu yang sekarang tidak ketimpa/hilang. Tempel sesuai petunjuk.
>
> Urutan aman: `transaksi.ts` → `proxy.ts` → `use-kasir-data.ts` → `kasir-view.tsx`
> → `payment-method.tsx` → `cart-panel.tsx` → `cart-summary.tsx` → `pengaturan-view.tsx`.
> (`features.ts` TIDAK di sini — versi utuhnya sudah ada di `src/lib/config/features.ts`.)

---

## 1) `src/lib/db/transaksi.ts` — tambah builder murni (WAJIB)

Webhook QRIS membuat transaksi di server. Supaya logika BOGO/diskon tidak diduplikasi,
ekstrak jadi fungsi murni `buildTransaksiPayload()` lalu `simpanTransaksi` memanggilnya.

### 1a. Tambahkan tipe & fungsi ini (mis. tepat sebelum `simpanTransaksi` lama)

```ts
// Baris transaction_items siap-INSERT.
export interface ItemInsertRow {
  id: string;
  transaksi_id: string;
  umkm_id: string;
  menu_item_id: string | null;
  nama_produk: string;
  harga_satuan: number;
  qty: number;
  item_type: "normal" | "discounted" | "promo_free";
  diskon_persen: number;
  diskon_preset_id: string | null;
  triggered_by_item_id: string | null;
  final_price_item: number;
}

// Baris transaksi (header) siap-INSERT.
export interface TrxInsertRow {
  id: string;
  umkm_id: string;
  nomor_order: string;
  status: "completed";
  diskon_preset_id: string | null;
  payment_method: "cash" | "qris" | "transfer" | "debit";
  grand_total: number;
  uang_diterima: number | null;
  kembalian: number | null;
  kasir_id: string;
}

export interface BuildTransaksiArgs {
  umkmId: string;
  kasirId: string;
  transaksiId: string;       // UUID header (digenerate pemanggil)
  nomorOrder: string;        // sudah digenerate pemanggil (RPC)
  cart: CartItem[];          // final (sudah lewat promo engine)
  diskonHeaderPresetId: string | null;
  diskonHeaderPersen: number;
  paymentMethod: "cash" | "qris" | "transfer" | "debit";
  uangDiterima: number | null;
  validMenuIds: Set<string>; // hasil validasi FK (dilakukan pemanggil)
}

// extended fields dari promo engine (sesuaikan kalau nama field-mu beda)
interface _PromoCartItem extends CartItem {
  _promo_pair_index?: number;
}

/** Bangun baris siap-INSERT TANPA call DB. Non-cash → uang/kembalian null. */
export function buildTransaksiPayload(args: BuildTransaksiArgs): {
  trxRow: TrxInsertRow; itemRows: ItemInsertRow[]; grandTotal: number;
} {
  const {
    umkmId, kasirId, transaksiId, nomorOrder, cart,
    diskonHeaderPresetId, diskonHeaderPersen, paymentMethod, uangDiterima, validMenuIds,
  } = args;

  const prepared: { id: string; pairKey: string | null; isPromoFree: boolean; row: ItemInsertRow }[] =
    cart.map((c) => {
      const ext = c as _PromoCartItem;
      const originalMenuId = c.menu_item_id;
      const safeMenuId = originalMenuId && validMenuIds.has(originalMenuId) ? originalMenuId : null;
      const pairIndex = ext._promo_pair_index ?? null;
      const pairKey = originalMenuId && pairIndex !== null ? `${originalMenuId}_${pairIndex}` : null;
      const isPromoFree = c.item_type === "promo_free";
      const itemId = crypto.randomUUID();

      if (isPromoFree) {
        return { id: itemId, pairKey, isPromoFree, row: {
          id: itemId, transaksi_id: transaksiId, umkm_id: umkmId,
          menu_item_id: safeMenuId, nama_produk: c.nama_produk,
          harga_satuan: c.harga_satuan, qty: c.qty,
          item_type: "promo_free", diskon_persen: 0, diskon_preset_id: null,
          triggered_by_item_id: null, final_price_item: 0,
        } };
      }

      const hasDiskon = diskonHeaderPersen > 0;
      const persen = hasDiskon ? diskonHeaderPersen : 0;
      const final_price_item = Math.round(c.harga_satuan * c.qty * (1 - persen / 100));
      return { id: itemId, pairKey, isPromoFree, row: {
        id: itemId, transaksi_id: transaksiId, umkm_id: umkmId,
        menu_item_id: safeMenuId, nama_produk: c.nama_produk,
        harga_satuan: c.harga_satuan, qty: c.qty,
        item_type: hasDiskon ? "discounted" : "normal",
        diskon_persen: persen,
        diskon_preset_id: hasDiskon ? diskonHeaderPresetId : null,
        triggered_by_item_id: null, final_price_item,
      } };
    });

  // pasangkan promo_free → item pemicu (pakai ORIGINAL menu id via pairKey)
  const pairToId = new Map<string, string>();
  for (const p of prepared) if (!p.isPromoFree && p.pairKey) pairToId.set(p.pairKey, p.id);
  for (const p of prepared) {
    if (p.isPromoFree && p.pairKey) p.row.triggered_by_item_id = pairToId.get(p.pairKey) ?? null;
  }

  const grandTotal = prepared.reduce((s, p) => s + p.row.final_price_item, 0);
  const uangFinal = paymentMethod === "cash"
    ? (uangDiterima !== null && uangDiterima >= grandTotal ? uangDiterima : grandTotal)
    : null;
  const kembalianFinal = paymentMethod === "cash" ? (uangFinal! - grandTotal) : null;

  const trxRow: TrxInsertRow = {
    id: transaksiId, umkm_id: umkmId, nomor_order: nomorOrder, status: "completed",
    diskon_preset_id: diskonHeaderPresetId, payment_method: paymentMethod,
    grand_total: grandTotal, uang_diterima: uangFinal, kembalian: kembalianFinal, kasir_id: kasirId,
  };
  return { trxRow, itemRows: prepared.map((p) => p.row), grandTotal };
}
```

> Jika nama/penanda promo di file-mu beda (mis. bukan `_promo_pair_index` atau
> `item_type === "promo_free"`), sesuaikan `buildTransaksiPayload` agar **persis** sama
> dengan logika pairing yang sudah kamu pakai di `simpanTransaksi` sekarang.

### 1b. Ubah `simpanTransaksi` agar memakai builder

Di dalam `simpanTransaksi` milikmu: **pertahankan** validasi `menu_item_id`,
`generateNomorOrder`, **batch insert**, dan rollback yang sudah ada. Ganti **hanya**
blok penyusunan baris + hitung `grand_total` dengan satu pemanggilan:

```ts
const transaksiId = crypto.randomUUID();
const nomor_order = await generateNomorOrder(umkmId);

const { trxRow, itemRows } = buildTransaksiPayload({
  umkmId, kasirId, transaksiId, nomorOrder: nomor_order, cart,
  diskonHeaderPresetId, diskonHeaderPersen, paymentMethod, uangDiterima, validMenuIds,
});

// INSERT header pakai trxRow, lalu batch INSERT itemRows (SATU statement),
// rollback (delete header) bila item gagal — sama seperti kode FIX B2/B8 kamu.
```

**Catatan:** jangan ubah fungsi dashboard/void/refund di file ini. Cukup tambah builder
(1a) dan sambungkan di `simpanTransaksi` (1b).

---

## 2) `src/proxy.ts` — webhook harus publik

Webhook dari PG tidak membawa cookie `umkm_id`. Tambahkan path-nya ke `PUBLIC_PATHS`:

```ts
const PUBLIC_PATHS = [
  "/aktivasi",
  "/api/aktivasi",
  "/api/payment/webhook",   // ← TAMBAHKAN (semua /api/payment/webhook/* publik)
];
```

> `/api/payment/create`, `/status`, dan `/credentials*` **tetap** di belakang cookie
> umkm (jangan dimasukkan ke PUBLIC_PATHS). Kalau pencocokan PUBLIC_PATHS kamu pakai
> `startsWith`, satu entri di atas sudah mencakup `/api/payment/webhook/xendit` dll.

---

## 3) `src/hooks/use-kasir-data.ts` — deteksi PG aktif (degradasi anggun)

Supaya opsi QRIS hanya aktif kalau tenant sudah setup PG. Tambah state + fetch
(hanya saat `features.qrisPayment`), dan ekspor `pgReady` dari hook:

```ts
import { features } from "@/lib/config/features";
// ...
const [pgReady, setPgReady] = useState(false);

useEffect(() => {
  if (!features.qrisPayment) return;
  let alive = true;
  (async () => {
    try {
      const res = await fetch("/api/payment/credentials");
      const data = await res.json();
      if (alive && data?.ok) {
        setPgReady((data.credentials ?? []).some((c: { is_active: boolean }) => c.is_active));
      }
    } catch { /* abaikan; pgReady tetap false */ }
  })();
  return () => { alive = false; };
}, []);

// ...lalu masukkan `pgReady` ke object return hook ini.
```

---

## 4) `src/components/kasir/kasir-view.tsx` — orkestrasi QRIS

Tambah: hook session, dialog QR, cabang `handleBayar`, dan efek saat `paid` → tampil struk.

```tsx
import { useEffect, useState } from "react";
import { features } from "@/lib/config/features";
import { usePaymentSession } from "@/hooks/use-payment-session";
import { QrisDialog } from "@/components/kasir/qris-dialog";
// asumsikan kamu sudah punya: useCartStore (cart, diskonPresetId, diskonPersen, reset),
// state struk + StrukDialog, grandTotal, paymentMethod, dan pgReady dari useKasirData.

const pay = usePaymentSession();
const [qrisOpen, setQrisOpen] = useState(false);

// Cabang tombol Bayar:
async function handleBayar() {
  const autoQris = features.qrisPayment && pgReady && paymentMethod === "qris";
  if (autoQris) {
    setQrisOpen(true);
    await pay.create({
      cart,                      // cart final (sudah lewat promo engine)
      diskonPresetId,            // dari store
      diskonPersen,              // dari store
      label: namaUmkm ?? "POS UMKM",
    });
    return;                      // JANGAN panggil bayar() cash di jalur QRIS
  }
  // ...jalur lama (cash/transfer/debit manual) tetap seperti sekarang: await bayar();
}

// Saat pembayaran QRIS sukses → tampilkan struk, tutup dialog, reset cart.
useEffect(() => {
  if (pay.state === "paid" && pay.struk) {
    setStruk(pay.struk);         // pakai state struk + StrukDialog yang sudah ada
    setQrisOpen(false);
    reset();                     // reset cart store (sama seperti setelah cash)
    pay.reset();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pay.state, pay.struk]);
```

Render dialog (mis. dekat StrukDialog):

```tsx
<QrisDialog
  open={qrisOpen}
  onOpenChange={(o) => { setQrisOpen(o); if (!o) pay.reset(); }}
  state={pay.state}
  qrString={pay.qrString}
  qrUrl={pay.qrUrl}
  secondsLeft={pay.secondsLeft}
  error={pay.error}
  amount={grandTotal}
  label={namaUmkm}
  onRegenerate={pay.regenerate}
/>
```

> **R1:** hanya `qris` yang lewat PG. `transfer`/`debit` (kalau ada di V2) tetap jalur
> manual lama. `cash` tidak berubah sama sekali.

---

## 5) `src/components/kasir/payment-method.tsx` — teks metode QRIS (opsional, kosmetik)

Saat metode `qris` & PG aktif, QR muncul setelah tekan Bayar. Tambahkan prop opsional
`autoQris?: boolean` dan ubah teks bantuan untuk `qris`:

```tsx
{method === "qris" && (
  <p className="text-xs text-muted-foreground">
    {autoQris
      ? "QR akan dibuat otomatis saat menekan tombol Bayar."
      : /* teks manual lama kamu */ "Tunjukkan QR ke pelanggan, lalu konfirmasi."}
  </p>
)}
```

---

## 6) `src/components/kasir/cart-panel.tsx` — teruskan status PG

Teruskan `pgReady`/`autoQris` dari `kasir-view` ke bawah (mis. ke `PaymentMethodPicker`
dan `CartSummary`):

```tsx
// tambah ke props CartPanel:
qrisPgReady?: boolean;

// turunkan: const autoQris = !!qrisPgReady && paymentMethod === "qris";
// <PaymentMethodPicker ... autoQris={autoQris} />
// <CartSummary ... autoQris={autoQris} />
```

> `canBayar` untuk `qris` **tidak perlu** cek uang diterima (itu hanya untuk `cash`).
> Logika `canBayar` non-cash kamu yang sekarang sudah benar — biarkan.

---

## 7) `src/components/kasir/cart-summary.tsx` — label tombol (opsional)

```tsx
// prop opsional: autoQris?: boolean
<Button onClick={onBayar} disabled={!canBayar}>
  {autoQris ? `Bayar via QRIS · ${fmtRupiah(grandTotal)}` : /* label lama kamu */ labelLama}
</Button>
```

---

## 8) `src/components/pengaturan/pengaturan-view.tsx` — menu setup PG

Tambah NavLink ke halaman setup, hanya muncul bila build v3:

```tsx
import { features } from "@/lib/config/features";
// ...di dalam daftar menu pengaturan:
{features.pgConnector && (
  <NavLinkPengaturan href="/pengaturan/pembayaran" label="Pembayaran (QRIS)" />
  /* samakan komponen/markup NavLink dgn item pengaturan lain yang sudah ada */
)}
```

---

## Setelah semua patch

1. `npm i qrcode.react`
2. Set env (lihat `README.md`): `NEXT_PUBLIC_POS_VERSION=v3`, `PG_ENCRYPTION_KEY=...`
3. Jalankan `migrations/001_v3_payment.sql`
4. Daftarkan webhook URL di dashboard PG (lihat README)
5. `Pengaturan → Pembayaran (QRIS)` → isi key → **Test Connection** → Simpan
6. Uji di **sandbox** dulu per provider.
