-- ============================================================
-- POS UMKM — Schema Final V1
-- Versi  : 1.3
-- Target : Supabase (PostgreSQL)
-- Scope  : Single UMKM, Owner-only, No Auth, RLS Disabled
-- ============================================================
-- CHANGELOG:
--   v1.0 — Initial schema
--   v1.1 — Fix: hapus CHECK nama_promo_internal (kolom tidak ada)
--   v1.2 — Fix: hapus RLS + policy, tambah generate_nomor_order,
--          perbaiki urutan CREATE TABLE sesuai dependency FK
--   v1.3 — Fix: komentar promo_rule dan trigger diluruskan —
--          tabel dan trigger ADA di DB tapi ENGINE TIDAK AKTIF di V1.
--          item_type di V1 hanya 'normal' dan 'discounted'.
--          'promo_free' dan triggered_by_item_id tidak dipakai
--          sampai V2. Komentar yang menyesatkan dihapus.
-- ============================================================
-- PENTING — BACA SEBELUM RUN:
--   Schema ini adalah FONDASI untuk V1 DAN V2.
--   Tabel promo_rule, kolom item_type (promo_free), kolom
--   triggered_by_item_id, dan trigger terkait ADA di schema ini
--   tapi TIDAK DIPAKAI di application layer V1.
--
--   Di V1, application layer HANYA menggunakan:
--     item_type = 'normal'     → transaksi biasa
--     item_type = 'discounted' → transaksi dengan diskon preset
--
--   item_type = 'promo_free', triggered_by_item_id, dan tabel
--   promo_rule baru diaktifkan di V2 (promo engine).
--
--   Trigger check_triggered_by_same_transaction ada di DB
--   tapi tidak akan pernah terpicu di V1 karena triggered_by_item_id
--   selalu NULL di semua transaksi V1.
-- ============================================================
-- CARA RUN:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste seluruh file ini
--   3. Klik Run
--   4. Aman dirun ulang — semua pakai IF NOT EXISTS / OR REPLACE
-- ============================================================


-- ============================================================
-- STEP 0: ENUM TYPES
-- Harus dibuat sebelum tabel apapun yang memakainya
--
-- CATATAN V1 vs V2:
--   item_type_enum  → V1 pakai: normal, discounted
--                     V2 tambah: promo_free (BOGO engine)
--   tipe_promo_enum → V1: tidak dipakai di application layer
--                     V2: dipakai saat promo engine aktif
--   payment_method_enum → V1 pakai: cash, qris
--                         V2 tambah: transfer, debit
--   transaksi_status_enum → V1 pakai: completed, void
--                           V2 tambah: refund
--   role_enum → V1 pakai: owner (system user saja)
--               V2 pakai: owner, kasir
-- ============================================================

DO $$ BEGIN
    CREATE TYPE item_type_enum        AS ENUM ('normal', 'discounted', 'promo_free');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaksi_status_enum AS ENUM ('completed', 'void', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipe_promo_enum       AS ENUM ('bogo', 'buy2get1');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum   AS ENUM ('cash', 'qris', 'transfer', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE role_enum             AS ENUM ('owner', 'kasir', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- STEP 1: AKTIVASI KODE
-- Tidak ada FK ke tabel lain — dibuat pertama
-- ============================================================

CREATE TABLE IF NOT EXISTS aktivasi_kode (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode           TEXT UNIQUE NOT NULL,
    used           BOOLEAN NOT NULL DEFAULT FALSE,
    umkm_id        UUID DEFAULT NULL,
    version_access TEXT NOT NULL DEFAULT 'v1',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at   TIMESTAMPTZ DEFAULT NULL,

    CHECK (kode <> '')
);


-- ============================================================
-- STEP 2: UMKM CONFIG
-- Tidak ada FK ke tabel lain
-- ============================================================

CREATE TABLE IF NOT EXISTS umkm_config (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id      UUID UNIQUE NOT NULL,
    nama_umkm    TEXT NOT NULL DEFAULT '',
    alamat       TEXT NOT NULL DEFAULT '',
    no_telp      TEXT NOT NULL DEFAULT '',
    footer_struk TEXT NOT NULL DEFAULT '',
    app_version  TEXT NOT NULL DEFAULT 'v1',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 3: USERS
-- Di V1: satu row per UMKM, role = 'owner', di-seed saat aktivasi
-- Di V2: multi-row, kasir punya akun sendiri dengan Supabase Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    username   TEXT NOT NULL,
    role       role_enum NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (umkm_id, username),
    CHECK (username <> '')
);


-- ============================================================
-- STEP 4: KATEGORI
-- ============================================================

CREATE TABLE IF NOT EXISTS kategori (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    nama       TEXT NOT NULL,
    urutan     INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (nama <> '')
);


-- ============================================================
-- STEP 5: MENU ITEM
-- Tulang punggung sistem — satu-satunya sumber harga dasar
-- TIDAK PERNAH hard delete — gunakan is_active = FALSE
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_item (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id      UUID NOT NULL,
    kategori_id  UUID REFERENCES kategori(id) ON DELETE SET NULL,
    nama         TEXT NOT NULL,
    harga        NUMERIC(12,2) NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    -- TRUE  = masih dijual (owner control, permanen)
    -- FALSE = tidak dijual lagi (soft delete — TIDAK PERNAH hard delete)
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    -- TRUE  = stok ada hari ini (owner/kasir toggle harian)
    -- FALSE = stok habis hari ini
    urutan       INTEGER NOT NULL DEFAULT 0,
    updated_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (harga >= 0),
    CHECK (nama <> '')
);


-- ============================================================
-- STEP 6: DISKON PRESET
-- Kasir hanya bisa pilih dari sini — tidak ada input nominal bebas
-- V1: owner seed 4 default (5%, 10%, 15%, 20%) saat aktivasi
-- NUMERIC(5,2) bukan INTEGER — support 12.5%
-- ============================================================

CREATE TABLE IF NOT EXISTS diskon_preset (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    nama       TEXT NOT NULL,
    persen     NUMERIC(5,2) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (persen > 0 AND persen < 100),
    CHECK (nama <> '')
);


-- ============================================================
-- STEP 7: PROMO RULE
-- ============================================================
-- STATUS DI V1: TABEL ADA, APPLICATION LAYER TIDAK MENGGUNAKANNYA
--
-- Tabel ini dibuat sekarang agar schema V2-ready dari hari pertama.
-- Di V1, tidak ada INSERT ke tabel ini dari application layer.
-- Tidak ada UI untuk kelola promo di V1.
-- Tidak ada promo engine di V1.
--
-- Di V2, tabel ini diaktifkan bersamaan dengan:
--   - src/lib/db/promo-rule.ts
--   - src/lib/cart/promo-engine.ts
--   - src/app/pengaturan/promo/page.tsx
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_rule (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id        UUID NOT NULL,
    menu_item_id   UUID NOT NULL REFERENCES menu_item(id),
    tipe_promo     tipe_promo_enum NOT NULL,
    qty_beli       INTEGER NOT NULL,
    qty_gratis     INTEGER NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    berlaku_mulai  TIMESTAMPTZ NOT NULL DEFAULT now(),
    berlaku_sampai TIMESTAMPTZ,
    -- NULL = tidak ada batas waktu
    updated_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (qty_beli > 0),
    CHECK (qty_gratis > 0),
    CHECK (qty_gratis < qty_beli),
    CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai),

    -- Satu tipe promo per item per umkm
    -- Overlap waktu harus di-enforce di application layer (KNOWN LIMITATION KL-01)
    UNIQUE (umkm_id, menu_item_id, tipe_promo)
);


-- ============================================================
-- STEP 8: TRANSAKSI (header)
-- ============================================================

CREATE TABLE IF NOT EXISTS transaksi (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id          UUID NOT NULL,
    nomor_order      TEXT NOT NULL,
    -- Format: YYYYMMDD-XXXX — di-generate server via generate_nomor_order()
    status           transaksi_status_enum NOT NULL DEFAULT 'completed',
    -- V1 pakai: completed, void
    -- V2 tambah: refund
    diskon_preset_id UUID REFERENCES diskon_preset(id),
    -- NULL = tidak ada diskon level transaksi
    payment_method   payment_method_enum NOT NULL,
    -- V1 pakai: cash, qris
    -- V2 tambah: transfer, debit
    grand_total      NUMERIC(12,2) NOT NULL,

    -- Cash reconciliation
    uang_diterima    NUMERIC(12,2),
    -- NOT NULL kalau payment_method = 'cash' (dijaga CHECK di bawah)
    -- NULL kalau bukan cash
    kembalian        NUMERIC(12,2),
    -- NOT NULL kalau payment_method = 'cash' (dijaga CHECK di bawah)
    -- NULL kalau bukan cash

    kasir_id         UUID NOT NULL REFERENCES users(id),
    -- V1: selalu system user yang di-seed saat aktivasi
    -- V2: user yang sedang login

    -- Void / refund audit trail
    void_by          UUID REFERENCES users(id),
    void_at          TIMESTAMPTZ,
    void_reason      TEXT,
    -- Ketiganya NULL kalau status = 'completed'
    -- Ketiganya NOT NULL kalau status = 'void' atau 'refund'
    -- (dijaga CHECK di bawah)

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (umkm_id, nomor_order),
    CHECK (grand_total >= 0),
    CHECK (nomor_order <> ''),

    -- Cash: uang_diterima dan kembalian wajib ada dan konsisten
    CHECK (
        payment_method <> 'cash'
        OR (
            uang_diterima IS NOT NULL
            AND uang_diterima >= grand_total
            AND kembalian IS NOT NULL
            AND kembalian = uang_diterima - grand_total
        )
    ),

    -- Non-cash: uang_diterima dan kembalian harus NULL
    CHECK (
        payment_method = 'cash'
        OR (uang_diterima IS NULL AND kembalian IS NULL)
    ),

    -- Void trail konsisten
    CHECK (
        (status = 'completed' AND void_by IS NULL AND void_at IS NULL)
        OR
        (status IN ('void', 'refund') AND void_by IS NOT NULL AND void_at IS NOT NULL)
    )
);


-- ============================================================
-- STEP 9: TRANSACTION ITEMS
-- SNAPSHOT PERMANEN — tidak boleh diubah setelah INSERT
-- ============================================================
-- CATATAN KOLOM V1 vs V2:
--
--   item_type:
--     V1 application layer HANYA mengisi 'normal' atau 'discounted'
--     V2 tambah 'promo_free' saat promo engine aktif
--
--   triggered_by_item_id:
--     V1: SELALU NULL — tidak ada BOGO di V1
--     V2: diisi saat item_type = 'promo_free'
--     Trigger check_triggered_by_same_transaction ada tapi tidak
--     akan pernah terpicu di V1 karena kolom ini selalu NULL
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_id         UUID NOT NULL REFERENCES transaksi(id),
    menu_item_id         UUID REFERENCES menu_item(id),
    -- Nullable: aman karena kita tidak pernah hard delete menu_item
    umkm_id              UUID NOT NULL,
    -- Denormalisasi untuk performa query rekap tanpa JOIN ke transaksi

    -- Snapshot permanen saat transaksi terjadi — tidak boleh berubah
    nama_produk          TEXT NOT NULL,
    harga_satuan         NUMERIC(12,2) NOT NULL,
    qty                  INTEGER NOT NULL,
    item_type            item_type_enum NOT NULL,
    -- V1: 'normal' atau 'discounted' saja
    -- V2: tambah 'promo_free'

    -- Diskon — hanya dari preset, tidak ada nominal bebas
    diskon_persen        NUMERIC(5,2) NOT NULL DEFAULT 0,
    diskon_preset_id     UUID REFERENCES diskon_preset(id),
    -- NULL kalau item_type = 'normal'

    -- BOGO link — V1: SELALU NULL. V2: diisi untuk item promo_free
    triggered_by_item_id UUID REFERENCES transaction_items(id),

    -- Hasil akhir — SELALU dihitung server, tidak pernah dari UI
    -- Formula: ROUND(harga_satuan * qty * (1 - diskon_persen / 100), 0)
    -- Rounding: round half up — kalikan dulu, baru bulatkan
    final_price_item     NUMERIC(12,2) NOT NULL,

    CHECK (harga_satuan >= 0),
    CHECK (qty > 0),
    CHECK (final_price_item >= 0),
    CHECK (diskon_persen >= 0 AND diskon_persen < 100),
    CHECK (nama_produk <> ''),

    -- item normal: tidak boleh ada diskon atau triggered_by
    CHECK (
        item_type <> 'normal'
        OR (
            diskon_persen = 0
            AND diskon_preset_id IS NULL
            AND triggered_by_item_id IS NULL
        )
    ),

    -- item promo_free: harga harus 0, diskon harus 0, triggered_by wajib ada
    -- V1: constraint ini tidak akan pernah dievaluasi karena item_type
    -- tidak pernah = 'promo_free' di V1
    CHECK (
        item_type <> 'promo_free'
        OR (
            final_price_item = 0
            AND diskon_persen = 0
            AND triggered_by_item_id IS NOT NULL
        )
    ),

    -- item discounted: diskon dan preset wajib ada
    CHECK (
        item_type <> 'discounted'
        OR (
            diskon_persen > 0
            AND diskon_preset_id IS NOT NULL
        )
    )
);


-- ============================================================
-- STEP 10: TRIGGER 1 — grand_total == SUM(final_price_item)
-- Aktif di V1 dan V2
-- Enforcement terakhir — tidak peduli server bug atau bypass
-- ============================================================

CREATE OR REPLACE FUNCTION check_grand_total()
RETURNS TRIGGER AS $$
DECLARE
    calculated_total NUMERIC(12,2);
    expected_total   NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(final_price_item), 0)
    INTO calculated_total
    FROM transaction_items
    WHERE transaksi_id = NEW.transaksi_id;

    SELECT grand_total
    INTO expected_total
    FROM transaksi
    WHERE id = NEW.transaksi_id;

    IF calculated_total <> expected_total THEN
        RAISE EXCEPTION
            'grand_total tidak cocok untuk transaksi %: expected %, calculated %',
            NEW.transaksi_id,
            expected_total,
            calculated_total;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_grand_total ON transaction_items;
CREATE CONSTRAINT TRIGGER trg_validate_grand_total
    AFTER INSERT ON transaction_items
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION check_grand_total();


-- ============================================================
-- STEP 11: TRIGGER 2 — triggered_by_item_id dalam transaksi yang sama
-- ============================================================
-- STATUS DI V1: TRIGGER ADA, TIDAK AKAN PERNAH TERPICU
--
-- Di V1, triggered_by_item_id selalu NULL di semua INSERT.
-- Trigger ini langsung return NEW tanpa cek apapun (NULL check di baris pertama).
-- Trigger baru terpicu di V2 saat promo engine mengisi triggered_by_item_id.
-- ============================================================

CREATE OR REPLACE FUNCTION check_triggered_by_same_transaction()
RETURNS TRIGGER AS $$
DECLARE
    source_transaksi_id UUID;
BEGIN
    -- NULL = bukan item promo. Skip. Selalu terjadi di V1.
    IF NEW.triggered_by_item_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT transaksi_id
    INTO source_transaksi_id
    FROM transaction_items
    WHERE id = NEW.triggered_by_item_id;

    IF source_transaksi_id IS NULL THEN
        RAISE EXCEPTION
            'triggered_by_item_id % tidak ditemukan di transaction_items',
            NEW.triggered_by_item_id;
    END IF;

    IF source_transaksi_id <> NEW.transaksi_id THEN
        RAISE EXCEPTION
            'triggered_by_item_id harus dalam transaksi yang sama. Item % ada di transaksi %, bukan %',
            NEW.triggered_by_item_id,
            source_transaksi_id,
            NEW.transaksi_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_triggered_by_same_transaction ON transaction_items;
CREATE TRIGGER trg_validate_triggered_by_same_transaction
    BEFORE INSERT ON transaction_items
    FOR EACH ROW
    EXECUTE FUNCTION check_triggered_by_same_transaction();


-- ============================================================
-- STEP 12: HELPER FUNCTION — nomor_order generator
-- Format: YYYYMMDD-XXXX (contoh: 20250529-0001)
-- Dipanggil dari server: SELECT generate_nomor_order('<umkm_id>')
-- KNOWN LIMITATION KL-03: SELECT MAX+1 — aman single kasir saja
-- ============================================================

CREATE OR REPLACE FUNCTION generate_nomor_order(p_umkm_id UUID)
RETURNS TEXT AS $$
DECLARE
    today_prefix TEXT;
    last_order   TEXT;
    last_num     INTEGER;
    next_num     INTEGER;
BEGIN
    today_prefix := TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');

    SELECT nomor_order
    INTO last_order
    FROM transaksi
    WHERE umkm_id = p_umkm_id
      AND nomor_order LIKE today_prefix || '-%'
    ORDER BY nomor_order DESC
    LIMIT 1;

    IF last_order IS NULL THEN
        next_num := 1;
    ELSE
        last_num := CAST(SPLIT_PART(last_order, '-', 2) AS INTEGER);
        next_num := last_num + 1;
    END IF;

    RETURN today_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- STEP 13: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transaksi_umkm_status_created
    ON transaksi (umkm_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaksi_kasir
    ON transaksi (kasir_id);

CREATE INDEX IF NOT EXISTS idx_transaksi_nomor_order
    ON transaksi (umkm_id, nomor_order);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaksi
    ON transaction_items (transaksi_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_menu
    ON transaction_items (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_item_type
    ON transaction_items (umkm_id, item_type);

CREATE INDEX IF NOT EXISTS idx_menu_item_umkm_active
    ON menu_item (umkm_id, is_active, is_available);

CREATE INDEX IF NOT EXISTS idx_kategori_umkm
    ON kategori (umkm_id, is_active);

CREATE INDEX IF NOT EXISTS idx_diskon_preset_umkm_active
    ON diskon_preset (umkm_id, is_active);

CREATE INDEX IF NOT EXISTS idx_promo_rule_menu_active
    ON promo_rule (menu_item_id, is_active, berlaku_mulai, berlaku_sampai);

CREATE INDEX IF NOT EXISTS idx_users_umkm_active
    ON users (umkm_id, is_active);


-- ============================================================
-- STEP 14: SEED — kode aktivasi test
-- Diskon preset default TIDAK di-seed di sini
-- Di-seed via application layer (src/app/api/aktivasi/route.ts)
-- saat owner aktivasi kode — bukan hardcoded di schema
-- ============================================================

INSERT INTO aktivasi_kode (kode, version_access) VALUES
    ('UMKM-MAMTA-01', 'v1'),
    ('UMKM-PILOT-02', 'v1'),
    ('UMKM-TEST-03',  'v1'),
    ('UMKM-DEV-04',   'v1')
ON CONFLICT (kode) DO NOTHING;


-- ============================================================
-- STEP 15: RLS — DISABLED UNTUK V1
-- Alasan: Supabase connection pooler reset session variable
-- antar request tanpa Supabase Auth.
-- Isolasi tenant di V1 via .eq('umkm_id', ...) di setiap query.
-- UTANG TEKNIS: aktifkan di V2 via pos_umkm_schema_v2_migration.sql
-- ============================================================

-- Tidak ada ALTER TABLE ... ENABLE ROW LEVEL SECURITY di V1.
-- Semua tabel defaultnya RLS = OFF di PostgreSQL — tidak perlu
-- eksplisit di-disable.


-- ============================================================
-- RINGKASAN FITUR V1 vs V2 (untuk developer)
-- ============================================================
--
-- Yang AKTIF di V1 (application layer menggunakannya):
--   ✓ item_type: 'normal', 'discounted'
--   ✓ payment_method: 'cash', 'qris'
--   ✓ status: 'completed', 'void'
--   ✓ role: 'owner' (satu system user per UMKM)
--   ✓ diskon_preset (CRUD + seed default)
--   ✓ generate_nomor_order()
--   ✓ Trigger check_grand_total (aktif setiap transaksi)
--
-- Yang ADA di schema tapi BELUM AKTIF di V1:
--   ✗ item_type: 'promo_free'       → aktif di V2 (promo engine)
--   ✗ triggered_by_item_id          → aktif di V2 (promo engine)
--   ✗ tabel promo_rule              → aktif di V2 (promo engine)
--   ✗ Trigger check_triggered_by    → ada tapi tidak terpicu di V1
--   ✗ payment_method: 'transfer', 'debit' → aktif di V2
--   ✗ status: 'refund'              → aktif di V2
--   ✗ role: 'kasir'                 → aktif di V2 (multi-user)
--   ✗ RLS                           → aktif di V2 (Supabase Auth)
--
-- Untuk aktifkan V2: jalankan pos_umkm_schema_v2_migration.sql
-- Tidak ada perubahan schema — hanya RLS dan kolom tambahan


-- ============================================================
-- KNOWN LIMITATIONS V1
-- ============================================================
-- KL-01: Overlap promo aktif untuk item yang sama tidak bisa
--        di-enforce di DB. Di V2, enforce di application layer
--        sebelum INSERT promo_rule.
--
-- KL-02: is_available tidak ada auto-reset harian ke TRUE.
--        Toggle manual oleh owner/kasir. Solusi V2: scheduled job.
--
-- KL-03: generate_nomor_order pakai SELECT MAX+1.
--        Aman single kasir. WAJIB diganti di V2 kalau multi-kasir.
--
-- KL-04: RLS disabled. Wajib .eq('umkm_id', ...) di setiap query.
--        Kalau satu query lupa filter → data UMKM lain bisa bocor.
--
-- KL-05: triggered_by_item_id dijaga trigger, bukan FK constraint.
--        Operasi bulk bypass trigger = integritas bisa rusak.


-- ============================================================
-- VERIFIKASI SETELAH RUN
-- ============================================================

-- 1. Tabel (harus 9 baris):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'aktivasi_kode','umkm_config','users','kategori',
--     'menu_item','diskon_preset','promo_rule',
--     'transaksi','transaction_items'
--   )
-- ORDER BY table_name;

-- 2. Triggers (harus 2):
-- SELECT trigger_name, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- ORDER BY trigger_name;

-- 3. Functions (harus 3):
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- ORDER BY routine_name;
-- Expected: check_grand_total, check_triggered_by_same_transaction,
--           generate_nomor_order

-- 4. RLS harus OFF semua (rowsecurity = false):
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;