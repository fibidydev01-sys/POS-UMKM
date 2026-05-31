# POS UMKM — Dokumentasi Teknis
> Coffee Shop · Single Outlet · Single Owner · Production-Ready
> **Schema:** v3.1 · **Codebase:** 1 repo, 2 mode (V1 / V2) via ENV
> **Last updated:** 2026-05-29 · Status: V1 ✅ Done · V2 ✅ Done

---

## Apa Ini

Aplikasi POS (Point of Sale) untuk coffee shop UMKM skala kecil. Didistribusikan lewat kode aktivasi. Owner aktivasi kode → setup profil → langsung operasi. Tidak ada login, tidak ada cloud dependency saat beroperasi.

**Satu prinsip yang tidak boleh dilanggar:**
> Rekap harus akurat sampai 1 rupiah terakhir. Tidak boleh ada yang kelewat.

---

## Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 15, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | **Tidak ada** — cookie `umkm_id` + `owner_id` |
| RLS | **Disabled** — isolasi via `.eq('umkm_id', ...)` |
| Export | SheetJS (XLSX) |
| Icons | lucide-react |
| Font | Plus Jakarta Sans |

---

## V1 vs V2 — Satu Codebase, Satu ENV

Tidak ada dua repo. Tidak ada dua branch. Satu codebase yang mode-nya dikontrol oleh:

```
# .env.local
NEXT_PUBLIC_POS_VERSION=v1   ← launch awal
NEXT_PUBLIC_POS_VERSION=v2   ← flip kapanpun siap
```

| Fitur | V1 | V2 |
|---|---|---|
| Cash + QRIS | ✅ | ✅ |
| Preset diskon (dari DB) | ✅ | ✅ |
| Kelola preset diskon | ✅ | ✅ |
| Void transaksi | ✅ | ✅ |
| Transfer + Debit | ❌ | ✅ |
| Refund transaksi | ❌ | ✅ |
| Promo BOGO / Buy2Get1 | ❌ | ✅ |
| Kelola program promo | ❌ | ✅ |

**Flip V1 → V2:** ubah ENV → redeploy → selesai. Tidak ada migrasi DB.

---

## Yang Tidak Ada di V1 maupun V2

Ini bukan bug, ini keputusan eksplisit:

- ❌ Login screen / username-password
- ❌ Multi-user / role kasir terpisah
- ❌ Supabase Auth / JWT
- ❌ RLS policies aktif
- ❌ Payment gateway (Midtrans, Xendit, dll)
- ❌ Multi-outlet
- ❌ Inventory / stok quantity
- ❌ Pajak (PPN)
- ❌ Auto-reset `is_available` harian

Semua ini masuk backlog V3 atau bukan scope produk ini.

---

## Struktur Dokumentasi

| File | Isi |
|---|---|
| **README.md** (ini) | Overview, quick reference |
| **01-ARSITEKTUR.md** | Filosofi, keputusan desain, rantai kepercayaan data |
| **02-SCHEMA.md** | Schema database lengkap, tabel, trigger, index |
| **03-FITUR.md** | Semua fitur, V1 vs V2, logika feature flag |
| **04-OPERASIONAL.md** | Flow kasir, kalkulasi server, formula BOGO, format struk |
| **05-DEPLOY.md** | Cara deploy, setup ENV, kode aktivasi, prosedur flip |
| **06-UTANG-TEKNIS.md** | Known limitations, checklist go-live, backlog V3 |

---

## File Structure Codebase

```
src/
├── app/
│   ├── api/aktivasi/route.ts      ← seed user + preset saat aktivasi
│   ├── kasir/page.tsx             ← halaman utama kasir
│   ├── menu/page.tsx              ← kelola menu
│   ├── riwayat/page.tsx           ← riwayat + void/refund
│   ├── dashboard/page.tsx         ← statistik omzet
│   ├── pengaturan/
│   │   ├── page.tsx               ← profil + backup + links
│   │   ├── diskon/page.tsx        ← kelola preset diskon (V1+V2)
│   │   └── promo/page.tsx         ← kelola program promo (V2 only)
│   └── aktivasi/page.tsx          ← aktivasi kode
├── components/
│   ├── kasir/
│   │   ├── diskon-input.tsx       ← pilih preset diskon
│   │   ├── keranjang-panel.tsx    ← cart + payment + BOGO display
│   │   ├── menu-grid.tsx
│   │   └── struk-print.tsx
│   ├── menu/
│   │   ├── form-menu-item.tsx
│   │   ├── menu-item-card.tsx
│   │   └── kategori-list.tsx
│   ├── pengaturan/
│   │   ├── form-diskon-preset.tsx
│   │   └── form-promo-rule.tsx    ← V2 only
│   ├── dashboard/
│   │   ├── chart-omzet.tsx
│   │   ├── stat-card.tsx
│   │   └── top-diskon.tsx
│   └── shared/
│       ├── bottom-nav.tsx
│       ├── alert-backup.tsx
│       └── empty-state.tsx
├── lib/
│   ├── config/
│   │   └── features.ts            ← ENV-based feature flags ← KEY FILE
│   ├── cart/
│   │   └── promo-engine.ts        ← BOGO pure function
│   ├── db/
│   │   ├── config.ts
│   │   ├── menu.ts
│   │   ├── transaksi.ts
│   │   ├── diskon-preset.ts
│   │   ├── promo-rule.ts
│   │   └── users.ts
│   ├── export/
│   │   ├── excel.ts
│   │   └── import.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils/
│       ├── currency.ts
│       ├── date.ts
│       └── umkm-id.ts
└── proxy.ts                       ← middleware: cek cookie umkm_id
```

---

## Quick Reference

### Aktivasi
```
POST /api/aktivasi  { kode: "UMKM-XXXX-01" }
→ seed umkm_config + users (owner) + 4 preset diskon default
→ set cookie umkm_id + owner_id (5 tahun)
```

### Cookie Identity
```
umkm_id  → UUID tenant, scoping semua query .eq('umkm_id', ...)
owner_id → UUID dari users table, dipakai sebagai kasir_id / updated_by / void_by
```

### Nomor Order Format
```
YYYYMMDD-XXXX   contoh: 20250529-0042
Reset setiap hari. Generate via DB function generate_nomor_order().
```

### Rounding Rule (TIDAK BOLEH BERUBAH)
```
final_price_item = ROUND(harga_satuan × qty × (1 − diskon_persen / 100), 0)
Kalikan dulu, bulatkan sekali. Round half up.
```
