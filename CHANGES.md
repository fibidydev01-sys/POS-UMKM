# POS UMKM — Changes Final Bundle

## Schema Fixes (schema.sql)

### FIX-01: promo_rule BOGO constraint
- **Bug:** `CHECK (qty_gratis < qty_beli)` — BOGO gagal INSERT
  karena beli=1, gratis=1 → `1 < 1 = FALSE`
- **Fix:** `CHECK (qty_gratis <= qty_beli)`
- **Impact:** Tanpa fix ini, tombol "Tambah Promo BOGO" selalu error

### FIX-02: discounted item tanpa preset_id
- **Bug:** `CHECK (... AND diskon_preset_id IS NOT NULL)` memblok
  V1 ENV mode yang pakai hardcoded preset (preset_id = null)
- **Fix:** Hapus syarat preset_id, cukup `diskon_persen > 0`
- **Impact:** Tanpa fix ini, transaksi dengan diskon di V1 mode selalu
  ditolak DB (INSERT transaction_items gagal)

---

## Code Changes

### `src/lib/config/features.ts` — NEW
Feature flags dari ENV var `NEXT_PUBLIC_POS_VERSION`.

```
NEXT_PUBLIC_POS_VERSION=v1     → V1 experience (default)
NEXT_PUBLIC_POS_VERSION=final  → Final experience
```

| Flag | V1 | Final |
|---|---|---|
| paymentExtended | Cash + QRIS saja | + Transfer + Debit |
| refund | Tidak ada | Ada |
| promoEngine | Tidak aktif | BOGO + Buy2Get1 |
| diskonDariDB | Hardcoded 5/10/15/20% | Dari DB |
| pengaturanLanjutan | Tanpa card Diskon+Promo | Dengan card |

### `src/lib/db/transaksi.ts` — 2 fixes
1. `hasDiskon`: hapus `&& diskonHeaderPresetId !== null`
   Sebelumnya diskon tidak diterapkan jika preset_id = null (V1 mode)
2. `getAnalisaDiskon`: fallback nama ke `Diskon X%` jika preset null
   Sebelumnya tampil "Unknown" di dashboard analisa diskon

### `src/app/kasir/page.tsx`
- Import `features`
- `getDiskonPreset`: hanya dipanggil jika `features.diskonDariDB`
- `getPromoAktif`: hanya dipanggil jika `features.promoEngine`
- `applyPromo`: hanya dijalankan jika `features.promoEngine`

### `src/components/kasir/diskon-input.tsx`
- V1 mode: tampilkan hardcoded [5, 10, 15, 20]% (preset_id = null)
- Final mode: load dari DB (existing behavior)

### `src/components/kasir/keranjang-panel.tsx`
- V1 mode: 2 payment method (Cash + QRIS)
- Final mode: 4 payment method (+ Transfer + Debit)

### `src/app/riwayat/page.tsx`
- Tombol Void: selalu ada (V1 dan Final)
- Tombol Refund: `{features.refund && <Button>Refund</Button>}`

### `src/app/pengaturan/page.tsx`
- Card "Preset Diskon" + "Program Promo": `{features.pengaturanLanjutan && ...}`
- V1 mode: kedua card disembunyikan

---

## Cara Deploy

### Fresh install
```
1. Jalankan schema.sql di Supabase SQL Editor
2. Deploy kode dengan NEXT_PUBLIC_POS_VERSION=v1
3. Tes fitur V1
4. Saat siap: ubah ENV ke final, redeploy
```

### Schema sudah ada (existing install)
```
1. Jalankan migration.sql di Supabase SQL Editor
2. Update file src/ sesuai bundle ini
3. Ubah NEXT_PUBLIC_POS_VERSION sesuai kebutuhan
4. Redeploy
```

### Flip ke Final
```
NEXT_PUBLIC_POS_VERSION=v1    →  NEXT_PUBLIC_POS_VERSION=final
Redeploy → selesai
```
