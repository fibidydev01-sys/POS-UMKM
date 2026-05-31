-- ============================================================
-- POS UMKM — Schema Final (Owner-Only + BOGO)
-- Versi  : V1 + V2 — FINAL
-- Target : Supabase (PostgreSQL)
-- ============================================================
-- CARA RUN:
--   1. Drop semua tabel lama terlebih dahulu (lihat CLEAN SLATE di bawah)
--   2. Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

-- ============================================================
-- OPTIONAL CLEAN SLATE (jalankan dulu jika schema lama ada)
-- ============================================================
-- DROP TABLE IF EXISTS transaction_items CASCADE;
-- DROP TABLE IF EXISTS transaksi CASCADE;
-- DROP TABLE IF EXISTS promo_rule CASCADE;
-- DROP TABLE IF EXISTS diskon_preset CASCADE;
-- DROP TABLE IF EXISTS menu_item CASCADE;
-- DROP TABLE IF EXISTS kategori CASCADE;
-- DROP TABLE IF EXISTS umkm_config CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS aktivasi_kode CASCADE;
-- DROP TYPE IF EXISTS item_type_enum CASCADE;
-- DROP TYPE IF EXISTS transaksi_status_enum CASCADE;
-- DROP TYPE IF EXISTS tipe_promo_enum CASCADE;
-- DROP TYPE IF EXISTS payment_method_enum CASCADE;
-- DROP TYPE IF EXISTS role_enum CASCADE;

-- ============================================================
-- STEP 0: ENUM TYPES
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
-- ============================================================

CREATE TABLE IF NOT EXISTS aktivasi_kode (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode           TEXT UNIQUE NOT NULL CHECK (kode <> ''),
    used           BOOLEAN NOT NULL DEFAULT FALSE,
    umkm_id        UUID DEFAULT NULL,
    version_access TEXT NOT NULL DEFAULT 'v1',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at   TIMESTAMPTZ DEFAULT NULL
);

-- ============================================================
-- STEP 2: UMKM CONFIG
-- NOTE: paper_width TIDAK ada di Supabase — disimpan di localStorage browser.
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
-- Owner-only. Satu row per UMKM. UUID disimpan di cookie owner_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    username   TEXT NOT NULL CHECK (username <> ''),
    role       role_enum NOT NULL DEFAULT 'owner',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (umkm_id, username)
);

-- ============================================================
-- STEP 4: KATEGORI
-- ============================================================

CREATE TABLE IF NOT EXISTS kategori (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    nama       TEXT NOT NULL CHECK (nama <> ''),
    urutan     INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 5: MENU ITEM
-- TIDAK PERNAH hard delete — is_active = FALSE untuk soft delete.
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_item (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id      UUID NOT NULL,
    kategori_id  UUID REFERENCES kategori(id) ON DELETE SET NULL,
    nama         TEXT NOT NULL CHECK (nama <> ''),
    harga        NUMERIC(12,2) NOT NULL CHECK (harga >= 0),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    urutan       INTEGER NOT NULL DEFAULT 0,
    updated_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 6: DISKON PRESET
-- ============================================================

CREATE TABLE IF NOT EXISTS diskon_preset (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    nama       TEXT NOT NULL CHECK (nama <> ''),
    persen     NUMERIC(5,2) NOT NULL CHECK (persen > 0 AND persen < 100),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 7: PROMO RULE
-- FIX: CHECK (qty_gratis <= qty_beli) — bukan < agar BOGO (1,1) valid.
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_rule (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id        UUID NOT NULL,
    menu_item_id   UUID NOT NULL REFERENCES menu_item(id),
    tipe_promo     tipe_promo_enum NOT NULL,
    qty_beli       INTEGER NOT NULL CHECK (qty_beli > 0),
    qty_gratis     INTEGER NOT NULL CHECK (qty_gratis > 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    berlaku_mulai  TIMESTAMPTZ NOT NULL DEFAULT now(),
    berlaku_sampai TIMESTAMPTZ DEFAULT NULL,
    updated_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (qty_gratis <= qty_beli),
    CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai),
    UNIQUE (umkm_id, menu_item_id, tipe_promo)
);

-- ============================================================
-- STEP 8: TRANSAKSI (header)
-- PERHATIAN: TIDAK ADA kolom diskon_persen di sini.
-- Informasi diskon tersimpan di transaction_items (per item).
--
-- Schema check untuk cash: uang_diterima wajib >= grand_total,
-- kembalian wajib = uang_diterima - grand_total.
-- Untuk V1 (tanpa fitur payment), app otomatis set
-- uang_diterima = grand_total dan kembalian = 0.
-- ============================================================

CREATE TABLE IF NOT EXISTS transaksi (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id          UUID NOT NULL,
    nomor_order      TEXT NOT NULL CHECK (nomor_order <> ''),
    status           transaksi_status_enum NOT NULL DEFAULT 'completed',
    diskon_preset_id UUID REFERENCES diskon_preset(id),
    payment_method   payment_method_enum NOT NULL,
    grand_total      NUMERIC(12,2) NOT NULL CHECK (grand_total >= 0),

    -- Cash: wajib isi uang_diterima dan kembalian
    uang_diterima    NUMERIC(12,2),
    kembalian        NUMERIC(12,2),

    kasir_id         UUID NOT NULL REFERENCES users(id),
    void_by          UUID REFERENCES users(id),
    void_at          TIMESTAMPTZ,
    void_reason      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (umkm_id, nomor_order),

    -- Cash check: uang_diterima dan kembalian wajib ada dan konsisten
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

    -- Status + void fields harus konsisten
    CHECK (
        (status = 'completed' AND void_by IS NULL AND void_at IS NULL)
        OR
        (status IN ('void', 'refund') AND void_by IS NOT NULL AND void_at IS NOT NULL)
    )
);

-- ============================================================
-- STEP 9: TRANSACTION ITEMS
-- SNAPSHOT PERMANEN — immutable setelah INSERT.
-- FIX: discounted item tidak wajib preset_id (V1 ENV mode ok).
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_id         UUID NOT NULL REFERENCES transaksi(id),
    menu_item_id         UUID REFERENCES menu_item(id),
    umkm_id              UUID NOT NULL,

    nama_produk          TEXT NOT NULL CHECK (nama_produk <> ''),
    harga_satuan         NUMERIC(12,2) NOT NULL CHECK (harga_satuan >= 0),
    qty                  INTEGER NOT NULL CHECK (qty > 0),
    item_type            item_type_enum NOT NULL,

    diskon_persen        NUMERIC(5,2) NOT NULL DEFAULT 0
                         CHECK (diskon_persen >= 0 AND diskon_persen < 100),
    diskon_preset_id     UUID REFERENCES diskon_preset(id),
    triggered_by_item_id UUID REFERENCES transaction_items(id),
    final_price_item     NUMERIC(12,2) NOT NULL CHECK (final_price_item >= 0),

    -- normal: tidak boleh ada diskon atau triggered_by
    CHECK (
        item_type <> 'normal'
        OR (
            diskon_persen = 0
            AND diskon_preset_id IS NULL
            AND triggered_by_item_id IS NULL
        )
    ),

    -- promo_free: harga 0, diskon 0, triggered_by wajib
    CHECK (
        item_type <> 'promo_free'
        OR (
            final_price_item = 0
            AND diskon_persen = 0
            AND triggered_by_item_id IS NOT NULL
        )
    ),

    -- discounted: diskon wajib > 0; preset_id OPSIONAL (V1 ENV mode ok)
    CHECK (
        item_type <> 'discounted'
        OR diskon_persen > 0
    )
);

-- ============================================================
-- STEP 10: TRIGGER — grand_total == SUM(final_price_item)
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

    SELECT grand_total INTO expected_total
    FROM transaksi WHERE id = NEW.transaksi_id;

    IF calculated_total <> expected_total THEN
        RAISE EXCEPTION
            'grand_total tidak cocok untuk transaksi %: expected %, calculated %',
            NEW.transaksi_id, expected_total, calculated_total;
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
-- STEP 11: TRIGGER — triggered_by_item_id dalam transaksi sama
-- ============================================================

CREATE OR REPLACE FUNCTION check_triggered_by_same_transaction()
RETURNS TRIGGER AS $$
DECLARE
    source_transaksi_id UUID;
BEGIN
    IF NEW.triggered_by_item_id IS NULL THEN RETURN NEW; END IF;

    SELECT transaksi_id INTO source_transaksi_id
    FROM transaction_items WHERE id = NEW.triggered_by_item_id;

    IF source_transaksi_id IS NULL THEN
        RAISE EXCEPTION 'triggered_by_item_id % tidak ditemukan', NEW.triggered_by_item_id;
    END IF;

    IF source_transaksi_id <> NEW.transaksi_id THEN
        RAISE EXCEPTION 'triggered_by_item_id harus dalam transaksi yang sama';
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
-- STEP 12: NOMOR ORDER GENERATOR
-- Format: YYYYMMDD-XXXX (zona Jakarta). Reset harian.
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

    SELECT nomor_order INTO last_order
    FROM transaksi
    WHERE umkm_id = p_umkm_id AND nomor_order LIKE today_prefix || '-%'
    ORDER BY nomor_order DESC LIMIT 1;

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
CREATE INDEX IF NOT EXISTS idx_promo_rule_umkm
    ON promo_rule (umkm_id, is_active);
CREATE INDEX IF NOT EXISTS idx_users_umkm_active
    ON users (umkm_id, is_active);

-- ============================================================
-- STEP 14: SEED — kode aktivasi
-- Diskon preset default di-seed via /api/aktivasi saat aktivasi.
-- ============================================================

INSERT INTO aktivasi_kode (kode, version_access) VALUES
    ('UMKM-MAMTA-01', 'v1'),
    ('UMKM-PILOT-02', 'v1'),
    ('UMKM-TEST-03',  'v1'),
    ('UMKM-DEV-04',   'v1'),
    ('UMKM-V2-01',    'v2'),
    ('UMKM-V2-02',    'v2'),
    ('UMKM-V2-TEST',  'v2')
ON CONFLICT (kode) DO NOTHING;

-- ============================================================
-- RLS — DISABLED (default PostgreSQL)
-- Isolasi tenant via .eq('umkm_id', ...) di setiap query.
-- ============================================================
