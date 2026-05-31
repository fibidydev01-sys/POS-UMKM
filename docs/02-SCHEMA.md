# 02 — Schema Database
> Versi schema: **3.1**
> PostgreSQL via Supabase · RLS: **DISABLED**
> File: `schema.sql` (fresh install) · `migration.sql` (schema sudah ada)

---

## ENUM Types

```sql
item_type_enum        ('normal', 'discounted', 'promo_free')
transaksi_status_enum ('completed', 'void', 'refund')
tipe_promo_enum       ('bogo', 'buy2get1')
payment_method_enum   ('cash', 'qris', 'transfer', 'debit')
role_enum             ('owner', 'kasir', 'system')
```

**Catatan:** `role_enum` punya nilai `kasir` dan `system` tapi di V1/V2 hanya `owner` yang dipakai. Nilai lain di-reserved untuk kompatibilitas.

---

## Tabel-Tabel

### `aktivasi_kode`
Kode distribusi produk. Di-generate developer, dikirim ke owner via WhatsApp.

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `kode` | TEXT | UNIQUE NOT NULL |
| `used` | BOOLEAN | DEFAULT FALSE |
| `umkm_id` | UUID | DEFAULT NULL — diisi saat klaim |
| `version_access` | TEXT | DEFAULT 'v1' — informasi saja, bukan feature gate |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `activated_at` | TIMESTAMPTZ | NULL — diisi saat klaim |

**Catatan:** `version_access` disimpan ke `umkm_config.app_version` dan ditampilkan di info card. Feature experience dikontrol ENV var, bukan field ini.

---

### `umkm_config`
Profil toko. Di-seed saat aktivasi, di-update via halaman Pengaturan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID UNIQUE | Satu row per UMKM |
| `nama_umkm` | TEXT | DEFAULT '' |
| `alamat` | TEXT | DEFAULT '' |
| `no_telp` | TEXT | DEFAULT '' |
| `footer_struk` | TEXT | DEFAULT '' |
| `app_version` | TEXT | DEFAULT 'v1' — dari version_access saat aktivasi |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

---

### `users`
Owner per UMKM. Di-seed saat aktivasi. Hanya satu row per UMKM (role = 'owner').

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Disimpan di cookie `owner_id` |
| `umkm_id` | UUID | FK implied (tidak ada FK eksplisit ke aktivasi) |
| `username` | TEXT | 'owner' untuk row default |
| `role` | role_enum | DEFAULT 'owner' |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**UNIQUE:** `(umkm_id, username)`
**CHECK:** `username <> ''`

**Kolom yang sengaja TIDAK ADA:** `auth_id`, `last_login_at` — tidak ada Supabase Auth.

**Kenapa tabel ini ada meskipun single user:**
Enam kolom di tabel lain FK ke `users.id`: `menu_item.updated_by`, `diskon_preset.updated_by`, `promo_rule.updated_by`, `transaksi.kasir_id`, `transaksi.void_by`. Tanpa tabel ini, semua INSERT gagal FK constraint.

---

### `kategori`
Kategori menu. Soft delete via `is_active = FALSE`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID | |
| `nama` | TEXT | CHECK: `nama <> ''` |
| `urutan` | INTEGER | DEFAULT 0 |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | |

**Catatan:** `menu_item.kategori_id` punya `ON DELETE SET NULL` — hapus kategori tidak hapus item menu-nya.

---

### `menu_item`
Tulang punggung sistem. **TIDAK PERNAH hard delete.**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID | |
| `kategori_id` | UUID | FK `kategori(id)` ON DELETE SET NULL |
| `nama` | TEXT | CHECK: `nama <> ''` |
| `harga` | NUMERIC(12,2) | CHECK: `harga >= 0` |
| `is_active` | BOOLEAN | Owner control — `FALSE` = soft delete permanen |
| `is_available` | BOOLEAN | Toggle harian kasir — `FALSE` = stok habis hari ini |
| `urutan` | INTEGER | DEFAULT 0 |
| `updated_by` | UUID | NOT NULL, FK `users(id)` |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**is_active vs is_available:**
- `is_active = FALSE` → item tidak pernah muncul lagi (permanen)
- `is_available = FALSE` → item tidak muncul hari ini (bisa di-toggle balik)

---

### `diskon_preset`
Preset diskon yang bisa dipilih kasir. Owner buat via `/pengaturan/diskon`. Di-seed 4 preset default saat aktivasi.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID | |
| `nama` | TEXT | CHECK: `nama <> ''`. Contoh: "Diskon Member", "Happy Hour" |
| `persen` | NUMERIC(5,2) | CHECK: `persen > 0 AND persen < 100` — support 12.5% |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `updated_by` | UUID | FK `users(id)` |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**Seed default saat aktivasi:** 5%, 10%, 15%, 20%

**Catatan:** Kasir hanya bisa pilih dari preset aktif. Tidak ada input angka bebas — by design untuk audit trail.

---

### `promo_rule`
Rule BOGO / Buy2Get1 per item. **Aktif di V2, tidak dipakai di V1.**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID | |
| `menu_item_id` | UUID | FK `menu_item(id)` |
| `tipe_promo` | tipe_promo_enum | `bogo` atau `buy2get1` |
| `qty_beli` | INTEGER | CHECK: `> 0`. bogo=1, buy2get1=2 |
| `qty_gratis` | INTEGER | CHECK: `> 0`. bogo=1, buy2get1=1 |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `berlaku_mulai` | TIMESTAMPTZ | DEFAULT now() |
| `berlaku_sampai` | TIMESTAMPTZ | NULL = tidak ada batas waktu |
| `updated_by` | UUID | FK `users(id)` |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**CHECK constraints:**
```sql
CHECK (qty_beli > 0)
CHECK (qty_gratis > 0)
CHECK (qty_gratis <= qty_beli)   ← FIX-01: sebelumnya < yang memblok BOGO
CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai)
```

**UNIQUE:** `(umkm_id, menu_item_id, tipe_promo)` — satu item hanya bisa punya satu tipe promo aktif.

**⚠️ KL-01:** UNIQUE mencegah tipe yang sama, tapi tidak mencegah overlap periode. Application layer yang cek sebelum INSERT.

---

### `transaksi`
Header transaksi. `grand_total` TIDAK dikirim dari UI — dihitung server, di-enforce trigger.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `umkm_id` | UUID | |
| `nomor_order` | TEXT | Format: YYYYMMDD-XXXX. Reset harian. |
| `status` | transaksi_status_enum | DEFAULT 'completed' |
| `diskon_preset_id` | UUID | FK `diskon_preset(id)` nullable — NULL = tidak ada diskon header |
| `payment_method` | payment_method_enum | NOT NULL |
| `grand_total` | NUMERIC(12,2) | CHECK: `>= 0` |
| `uang_diterima` | NUMERIC(12,2) | nullable — hanya cash |
| `kembalian` | NUMERIC(12,2) | nullable — hanya cash |
| `kasir_id` | UUID | NOT NULL, FK `users(id)` — selalu owner UUID |
| `void_by` | UUID | FK `users(id)` nullable |
| `void_at` | TIMESTAMPTZ | nullable |
| `void_reason` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**UNIQUE:** `(umkm_id, nomor_order)`

**CHECK constraints:**
```sql
-- Cash: uang_diterima wajib ada dan konsisten
CHECK (
    payment_method <> 'cash'
    OR (
        uang_diterima IS NOT NULL
        AND uang_diterima >= grand_total
        AND kembalian IS NOT NULL
        AND kembalian = uang_diterima - grand_total
    )
)

-- Non-cash: uang_diterima dan kembalian harus NULL
CHECK (
    payment_method = 'cash'
    OR (uang_diterima IS NULL AND kembalian IS NULL)
)

-- Void trail: wajib lengkap jika status void/refund
CHECK (
    (status = 'completed' AND void_by IS NULL AND void_at IS NULL)
    OR
    (status IN ('void', 'refund') AND void_by IS NOT NULL AND void_at IS NOT NULL)
)
```

---

### `transaction_items`
Baris per item. **SNAPSHOT PERMANEN — immutable setelah INSERT.**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | |
| `transaksi_id` | UUID | FK `transaksi(id)` |
| `umkm_id` | UUID | Denormalisasi untuk performa query rekap |
| `menu_item_id` | UUID | FK `menu_item(id)` nullable (menu soft-deleted aman) |
| `nama_produk` | TEXT | **Snapshot** — nama saat transaksi |
| `harga_satuan` | NUMERIC(12,2) | **Snapshot** — harga saat transaksi. CHECK: `>= 0` |
| `qty` | INTEGER | CHECK: `> 0` |
| `item_type` | item_type_enum | normal / discounted / promo_free |
| `diskon_persen` | NUMERIC(5,2) | DEFAULT 0. CHECK: `>= 0 AND < 100` |
| `diskon_preset_id` | UUID | FK `diskon_preset(id)` nullable |
| `triggered_by_item_id` | UUID | FK self-referential nullable — untuk promo_free |
| `final_price_item` | NUMERIC(12,2) | CHECK: `>= 0`. Dihitung server. |

**CHECK constraints:**
```sql
-- item normal: tidak boleh ada diskon atau triggered_by
CHECK (
    item_type <> 'normal'
    OR (diskon_persen = 0 AND diskon_preset_id IS NULL AND triggered_by_item_id IS NULL)
)

-- item promo_free: harga 0, diskon 0, triggered_by WAJIB ada
CHECK (
    item_type <> 'promo_free'
    OR (final_price_item = 0 AND diskon_persen = 0 AND triggered_by_item_id IS NOT NULL)
)

-- item discounted: diskon wajib ada, preset OPSIONAL
-- FIX-02: sebelumnya AND diskon_preset_id IS NOT NULL yang memblok V1 mode
CHECK (
    item_type <> 'discounted'
    OR diskon_persen > 0
)
```

---

## Triggers & Functions

### Trigger 1 — `trg_validate_grand_total`

```
Event:    AFTER INSERT on transaction_items
Type:     CONSTRAINT TRIGGER, DEFERRABLE INITIALLY DEFERRED
Fungsi:   check_grand_total()

Logika:
  SUM(final_price_item) WHERE transaksi_id = NEW.transaksi_id
  HARUS = grand_total di header transaksi

  Kalau tidak cocok → RAISE EXCEPTION → seluruh batch di-rollback
```

DEFERRED karena semua items diinsert dulu, baru trigger cek total.

### Trigger 2 — `trg_validate_triggered_by_same_transaction`

```
Event:    BEFORE INSERT on transaction_items
Fungsi:   check_triggered_by_same_transaction()

Logika:
  Jika triggered_by_item_id IS NULL → return NEW (skip)
  Cari transaksi_id dari triggered_by_item_id
  Harus sama dengan NEW.transaksi_id
  Kalau beda → RAISE EXCEPTION

V1: selalu NULL → trigger selalu skip
V2: aktif saat promo engine isi triggered_by_item_id
```

### Function — `generate_nomor_order(p_umkm_id UUID)`

```
Format output: YYYYMMDD-XXXX (contoh: 20250529-0042)
Timezone: Asia/Jakarta
Reset: setiap hari
Logic: SELECT MAX(nomor_order) WHERE hari ini → +1
```

**⚠️ KL-03:** SELECT MAX+1 aman untuk single owner. Tidak aman kalau ada concurrent INSERT dari dua session berbeda.

---

## Indexes

| Index | Tabel | Kolom | Fungsi |
|---|---|---|---|
| `idx_transaksi_umkm_status_created` | transaksi | `(umkm_id, status, created_at DESC)` | Filter rekap per status |
| `idx_transaksi_kasir` | transaksi | `(kasir_id)` | Lookup per kasir |
| `idx_transaksi_nomor_order` | transaksi | `(umkm_id, nomor_order)` | Lookup nomor order |
| `idx_transaction_items_transaksi` | transaction_items | `(transaksi_id)` | Join ke header |
| `idx_transaction_items_menu` | transaction_items | `(menu_item_id)` | Lookup per item |
| `idx_transaction_items_item_type` | transaction_items | `(umkm_id, item_type)` | Analisa per tipe |
| `idx_menu_item_umkm_active` | menu_item | `(umkm_id, is_active, is_available)` | Load menu kasir |
| `idx_kategori_umkm` | kategori | `(umkm_id, is_active)` | Load kategori aktif |
| `idx_diskon_preset_umkm_active` | diskon_preset | `(umkm_id, is_active)` | Load preset kasir |
| `idx_promo_rule_menu_active` | promo_rule | `(menu_item_id, is_active, berlaku_mulai, berlaku_sampai)` | Cek promo aktif |
| `idx_promo_rule_umkm` | promo_rule | `(umkm_id, is_active)` | Lookup promo per UMKM |
| `idx_users_umkm_active` | users | `(umkm_id, is_active)` | Lookup owner |

Total: **12 indexes**

---

## RLS — Disabled

RLS tidak aktif di semua tabel. Isolasi tenant dijaga di application layer:
```typescript
// Wajib ada di SETIAP query
.eq('umkm_id', umkmId)
```

**⚠️ KL-04:** Kalau ada satu query yang lupa filter ini, data UMKM lain bisa bocor. Semua fungsi di `src/lib/db/*.ts` sudah include filter ini.

---

## Schema Fixes yang Sudah Diterapkan (v3.0 → v3.1)

### FIX-01: BOGO qty_gratis Constraint

**Bug:** `CHECK (qty_gratis < qty_beli)` memblok BOGO karena `qty_beli=1, qty_gratis=1` → `1 < 1 = FALSE` → INSERT gagal.

**Fix:** `CHECK (qty_gratis <= qty_beli)`

### FIX-02: Discounted Item Tidak Wajib Preset ID

**Bug:** `CHECK (... AND diskon_preset_id IS NOT NULL)` di `transaction_items` memblok kasus di mana diskon diterapkan tapi `diskon_preset_id = null`. Ini terjadi di skenario edge case tertentu.

**Fix:** Hapus syarat `diskon_preset_id IS NOT NULL` — cukup `diskon_persen > 0`.

**Migration:** Kalau schema sudah deployed, jalankan `migration.sql` untuk patch kedua constraint ini tanpa perlu recreate tabel.

---

## Seed Data

```sql
-- Kode aktivasi untuk testing
INSERT INTO aktivasi_kode (kode, version_access) VALUES
    ('UMKM-MAMTA-01', 'v1'),
    ('UMKM-PILOT-02', 'v1'),
    ('UMKM-TEST-03',  'v1'),
    ('UMKM-DEV-04',   'v1'),
    ('UMKM-V2-01',    'v2'),
    ('UMKM-V2-02',    'v2'),
    ('UMKM-V2-TEST',  'v2')
ON CONFLICT (kode) DO NOTHING;
```

Preset diskon default (5%, 10%, 15%, 20%) **TIDAK di-seed di SQL** — di-seed oleh `/api/aktivasi/route.ts` saat owner aktivasi kode.

---

## Verifikasi Setelah Run Schema

```sql
-- 1. Cek tabel (harus 9 baris)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'aktivasi_kode','umkm_config','users','kategori',
    'menu_item','diskon_preset','promo_rule',
    'transaksi','transaction_items'
  );

-- 2. Cek triggers (harus 2)
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 3. Cek functions (harus 3)
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';

-- 4. Cek RLS semua OFF
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';

-- 5. Verifikasi FIX-01 (harus <=)
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'promo_rule'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%qty_gratis%';

-- 6. Verifikasi FIX-02 (tidak boleh ada IS NOT NULL untuk diskon_preset_id)
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'transaction_items'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%discounted%';
```
