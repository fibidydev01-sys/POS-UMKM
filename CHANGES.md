# POS UMKM — Changes Bundle V1+V2

## Pembagian Fitur V1 vs V2

| Fitur | V1 | V2 |
|---|---|---|
| Cash + QRIS | ✅ | ✅ |
| Transfer + Debit | ❌ | ✅ |
| Void transaksi | ✅ | ✅ |
| Refund transaksi | ❌ | ✅ |
| **Preset diskon (dari DB)** | **✅** | **✅** |
| **Kelola preset diskon** | **✅** | **✅** |
| BOGO / Buy2Get1 | ❌ | ✅ |
| Kelola program promo | ❌ | ✅ |

**Kunci:** Preset diskon AKTIF di V1 maupun V2. Default 4 preset
(5%, 10%, 15%, 20%) di-seed otomatis saat aktivasi kode.

---

## Feature Flags (features.ts)

```typescript
// 4 flags saja — diskonDariDB dihapus (preset selalu dari DB)
export const features = {
  paymentExtended: isV2,   // Transfer + Debit
  refund: isV2,            // Refund button
  promoEngine: isV2,       // BOGO engine
  promoManagement: isV2,   // Card Program Promo di pengaturan
}
```

---

## Schema Fixes (schema.sql)

**FIX-01:** `promo_rule` — `CHECK (qty_gratis <= qty_beli)`
- Sebelumnya `<` memblok BOGO (beli=1, gratis=1 → 1 < 1 = FALSE)

**FIX-02:** `transaction_items` — discounted item tidak wajib preset_id
- Sebelumnya `AND diskon_preset_id IS NOT NULL` menyebabkan FK error

---

## File Changes

| File | Status | Perubahan |
|---|---|---|
| `src/lib/config/features.ts` | NEW | 4 flags, hapus `diskonDariDB` |
| `src/lib/db/transaksi.ts` | FIXED | `hasDiskon` fix + `AnalisaDiskon` fallback |
| `src/app/kasir/page.tsx` | UPDATED | Preset selalu dari DB, promo conditional |
| `src/components/kasir/diskon-input.tsx` | SIMPLIFIED | Hapus hardcoded V1 mode |
| `src/components/kasir/keranjang-panel.tsx` | UPDATED | 2 vs 4 payment method |
| `src/app/riwayat/page.tsx` | UPDATED | Refund button V2 only |
| `src/app/pengaturan/page.tsx` | UPDATED | Preset Diskon selalu tampil, Promo V2 only |

---

## Deploy

### .env.local
```
NEXT_PUBLIC_POS_VERSION=v1   # launch awal
NEXT_PUBLIC_POS_VERSION=v2   # flip ke V2
```

### Kode Aktivasi
| Kode | version_access | Experience |
|---|---|---|
| UMKM-MAMTA-01, UMKM-PILOT-02, dll | v1 | V1 |
| UMKM-V2-01, UMKM-V2-02, UMKM-V2-TEST | v2 | V2 |

> Catatan: `version_access` di DB hanya untuk display (`app_version` di info card).
> Feature experience dikontrol ENV, bukan DB.
