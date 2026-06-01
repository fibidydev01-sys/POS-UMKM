-- ============================================================
-- POS UMKM — SCHEMA FINAL (SUDAH DI-FIX)
-- Versi  : V1 + V2 — FINAL (audit 2026-06-01)
-- Target : Supabase (PostgreSQL)
-- ============================================================
-- RINGKASAN PERUBAHAN vs schema_final lama (4 fix utama):
--   [FIX B3] transaction_items.transaksi_id            -> ON DELETE CASCADE
--   [FIX B3] transaction_items.triggered_by_item_id    -> ON DELETE CASCADE
--   [FIX B2] trg_validate_triggered_by_same_transaction -> CONSTRAINT TRIGGER
--            AFTER INSERT, DEFERRABLE INITIALLY DEFERRED (lihat STEP 11)
--   [FIX S1] RLS dimatikan EKSPLISIT + GRANT jelas + WARNING + jalur hardening
-- Sisanya dipertahankan: ENUM, semua tabel, check grand_total (deferred),
-- generator nomor order (Jakarta), indexes, seed kode aktivasi v1 & v2.
-- ============================================================
-- CARA RUN:
--   1. (Opsional) jalankan blok CLEAN SLATE di bawah jika skema lama ada.
--   2. Supabase Dashboard -> SQL Editor -> paste seluruh file -> Run.
--   3. Lanjut ke 05-CHECKLIST-EDIT-KODE.md untuk edit sisi aplikasi.
-- ============================================================


-- ============================================================
-- OPTIONAL CLEAN SLATE (hapus skema lama lebih dulu jika perlu)
-- Hapus tanda komentar (--) pada blok ini untuk mereset total.
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
-- DROP TYPE  IF EXISTS item_type_enum CASCADE;
-- DROP TYPE  IF EXISTS transaksi_status_enum CASCADE;
-- DROP TYPE  IF EXISTS tipe_promo_enum CASCADE;
-- DROP TYPE  IF EXISTS payment_method_enum CASCADE;
-- DROP TYPE  IF EXISTS role_enum CASCADE;


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
-- STEP 2: UMKM CONFIG (profil usaha)
-- NOTE: paper_width TIDAK ada di sini -> disimpan di localStorage browser.
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
-- STEP 3: USERS (owner-only, satu row per UMKM)
-- UUID owner disimpan di cookie owner_id.
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
-- TIDAK PERNAH hard delete dari app -> is_active = FALSE (soft delete).
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
-- CHECK (qty_gratis <= qty_beli) supaya BOGO (1,1) valid.
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
-- Info diskon tersimpan di transaction_items (per item).
--
-- Aturan cash: uang_diterima wajib >= grand_total,
-- kembalian wajib = uang_diterima - grand_total.
-- V1 (tanpa fitur payment): app set uang_diterima = grand_total, kembalian = 0.
-- ============================================================

CREATE TABLE IF NOT EXISTS transaksi (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id          UUID NOT NULL,
    nomor_order      TEXT NOT NULL CHECK (nomor_order <> ''),
    status           transaksi_status_enum NOT NULL DEFAULT 'completed',
    diskon_preset_id UUID REFERENCES diskon_preset(id),
    payment_method   payment_method_enum NOT NULL,
    grand_total      NUMERIC(12,2) NOT NULL CHECK (grand_total >= 0),

    uang_diterima    NUMERIC(12,2),
    kembalian        NUMERIC(12,2),

    kasir_id         UUID NOT NULL REFERENCES users(id),
    void_by          UUID REFERENCES users(id),
    void_at          TIMESTAMPTZ,
    void_reason      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (umkm_id, nomor_order),

    -- Cash: uang_diterima & kembalian wajib ada dan konsisten
    CHECK (
        payment_method <> 'cash'
        OR (
            uang_diterima IS NOT NULL
            AND uang_diterima >= grand_total
            AND kembalian IS NOT NULL
            AND kembalian = uang_diterima - grand_total
        )
    ),

    -- Non-cash: uang_diterima & kembalian harus NULL
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
-- STEP 9: TRANSACTION ITEMS (snapshot permanen, immutable)
--
-- [FIX B3] transaksi_id          : ON DELETE CASCADE
--          -> import destruktif (DELETE FROM transaksi) kini ikut menghapus
--             item-nya, tidak lagi gagal karena FK.
-- [FIX B3] triggered_by_item_id  : ON DELETE CASCADE
--          -> hapus item pemicu ikut menghapus item gratis turunannya.
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_id         UUID NOT NULL
                         REFERENCES transaksi(id) ON DELETE CASCADE,          -- [FIX B3]
    menu_item_id         UUID REFERENCES menu_item(id),
    umkm_id              UUID NOT NULL,

    nama_produk          TEXT NOT NULL CHECK (nama_produk <> ''),
    harga_satuan         NUMERIC(12,2) NOT NULL CHECK (harga_satuan >= 0),
    qty                  INTEGER NOT NULL CHECK (qty > 0),
    item_type            item_type_enum NOT NULL,

    diskon_persen        NUMERIC(5,2) NOT NULL DEFAULT 0
                         CHECK (diskon_persen >= 0 AND diskon_persen < 100),
    diskon_preset_id     UUID REFERENCES diskon_preset(id),
    triggered_by_item_id UUID
                         REFERENCES transaction_items(id) ON DELETE CASCADE,  -- [FIX B3]
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
-- CONSTRAINT TRIGGER DEFERRED: dicek saat COMMIT, bukan per-baris.
-- Penting: app HARUS insert header + semua item dalam SATU transaksi DB
-- (batch insert) supaya saat COMMIT jumlahnya sudah cocok. Lihat
-- 05-CHECKLIST-EDIT-KODE.md item 3 (simpanTransaksi batch).
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

    -- Kalau header sudah terhapus (mis. CASCADE saat import), lewati.
    IF expected_total IS NULL THEN
        RETURN NEW;
    END IF;

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
--
-- [FIX B2] Diubah dari BEFORE INSERT biasa menjadi CONSTRAINT TRIGGER
--          AFTER INSERT DEFERRABLE INITIALLY DEFERRED.
--          Alasan: dengan batch insert, item pemicu (parent) dan item
--          gratis (child) masuk dalam satu statement. Pengecekan saat
--          COMMIT memastikan parent sudah ada -> tidak false-negative.
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
CREATE CONSTRAINT TRIGGER trg_validate_triggered_by_same_transaction      -- [FIX B2]
    AFTER INSERT ON transaction_items
    DEFERRABLE INITIALLY DEFERRED
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
-- STEP 14: SEED — kode aktivasi (v1 & v2)
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
-- STEP 15: RLS & GRANTS — [FIX S1]
-- ============================================================
-- !!! WARNING KEAMANAN — BACA SEBELUM PRODUKSI !!!
--
-- Aplikasi ini memakai ANON KEY di sisi browser (lihat
-- src/lib/supabase/client.ts) dan RLS SENGAJA DIMATIKAN.
-- Artinya: SATU-SATUNYA pembatas antar-tenant adalah filter
-- .eq('umkm_id', <uuid dari cookie>) di setiap query aplikasi.
--
-- Untuk MVP "owner-only, 1 device" ini DAPAT DITERIMA: tidak ada
-- pengguna lain yang berbagi DB pada perangkat itu. NAMUN ini
-- BUKAN hardening — siapa pun yang memegang anon key dan menebak
-- sebuah umkm_id secara teori bisa membaca data tenant tsb lewat
-- API publik Supabase.
--
-- JALUR HARDENING (lihat 03-ARSITEKTUR.md §4):
--   Opsi B  : pindahkan akses sensitif ke route handler (app/api/*)
--             memakai SERVICE ROLE KEY, lalu CABUT grant anon
--             (REVOKE ... FROM anon) di bawah.
--   Opsi C  : aktifkan Supabase Auth + RLS penuh, contoh policy:
--               ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
--               CREATE POLICY tenant_isolation ON transaksi
--                 USING (umkm_id = (auth.jwt() ->> 'umkm_id')::uuid);
--             (ulangi untuk tiap tabel ber-umkm_id)
-- ============================================================

-- Matikan RLS secara EKSPLISIT (default Postgres, ditegaskan di sini).
ALTER TABLE aktivasi_kode      DISABLE ROW LEVEL SECURITY;
ALTER TABLE umkm_config        DISABLE ROW LEVEL SECURITY;
ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE kategori           DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item          DISABLE ROW LEVEL SECURITY;
ALTER TABLE diskon_preset      DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_rule         DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi          DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items  DISABLE ROW LEVEL SECURITY;

-- GRANT untuk peran Supabase. anon & authenticated dipakai oleh client;
-- service_role dipakai route handler server (mis. /api/aktivasi).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Default privileges supaya objek baru ikut ter-grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- --- SAAT HARDENING (Opsi B), aktifkan baris berikut untuk MENCABUT anon: ---
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public FROM anon;
-- REVOKE USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- REVOKE EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public FROM anon;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- ============================================================
-- SELESAI. Lanjut: 05-CHECKLIST-EDIT-KODE.md
-- ============================================================
