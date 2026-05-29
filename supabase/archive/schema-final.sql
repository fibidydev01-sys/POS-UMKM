-- ============================================================
-- POS UMKM — Schema Final (Owner-Only + BOGO)
-- Versi  : 3.0
-- Target : Supabase (PostgreSQL)
-- Scope  : Single UMKM, Single Owner, No Auth, BOGO aktif
-- ============================================================
-- KEPUTUSAN ARSITEKTUR:
--   - Merger V1 + V2 dengan satu keputusan besar: NO multi-user
--   - Owner adalah satu-satunya pengguna — tidak ada role kasir
--   - Tidak ada Supabase Auth, tidak ada JWT, tidak ada login screen
--   - Identitas tenant: cookie umkm_id + cookie owner_id (set saat aktivasi)
--   - BOGO aktif (promo_rule, item_type promo_free, triggered_by_item_id)
--   - RLS DISABLED — isolasi via .eq('umkm_id', ...) di setiap query
--   - Semua fitur V2 yang bergantung multi-user DIHAPUS dari schema ini
-- ============================================================
-- PERBEDAAN DARI V1:
--   + promo_rule aktif (BOGO engine)
--   + item_type promo_free aktif
--   + triggered_by_item_id aktif
--   + payment_method transfer + debit aktif
--   + status refund aktif
--   - auth_id (dihapus dari users)
--   - last_login_at (dihapus dari users)
--   - role kasir tidak pernah dipakai
-- ============================================================
-- PERBEDAAN DARI V2:
--   - Tidak ada Supabase Auth integration
--   - Tidak ada RLS / JWT policy
--   - Tidak ada get_umkm_id_from_jwt()
--   - Tidak ada get_current_user_id()
--   - Tidak ada is_owner()
--   - Tidak ada idx_users_auth_id
--   - users.auth_id tidak ada
--   - users.last_login_at tidak ada
--   - role enum masih ada tapi hanya value 'owner' yang dipakai
-- ============================================================
-- CARA RUN:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste seluruh file ini
--   3. Klik Run
--   4. Aman dirun ulang — semua pakai IF NOT EXISTS / OR REPLACE
--   5. Verifikasi dengan query di bagian akhir file
-- ============================================================


-- ============================================================
-- STEP 0: ENUM TYPES
-- ============================================================
-- item_type_enum:
--   normal      → transaksi biasa tanpa diskon
--   discounted  → transaksi dengan diskon preset
--   promo_free  → item gratis dari BOGO (aktif)
--
-- transaksi_status_enum:
--   completed → transaksi selesai, masuk rekap
--   void      → dibatalkan owner, tidak masuk rekap
--   refund    → pembeli minta uang balik, tidak masuk rekap
--
-- payment_method_enum:
--   cash, qris, transfer, debit — semua aktif
--
-- role_enum:
--   owner  → satu-satunya role yang dipakai
--   kasir  → ada di enum tapi TIDAK PERNAH dipakai
--   system → legacy, tidak dipakai
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
-- Dibuat pertama — tidak ada FK ke tabel lain.
-- Developer/penjual generate kode di sini, kirim ke owner via WhatsApp.
-- Setelah aktivasi: used = TRUE, umkm_id terisi, activated_at terisi.
-- Re-aktivasi device sama: kode yang sama bisa dipakai ulang (cek di route.ts).
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
-- Profil toko: nama, alamat, footer struk.
-- Di-seed saat aktivasi. Di-update owner via halaman Pengaturan.
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
-- Owner-only. Satu row per UMKM, role = 'owner'.
-- Di-seed saat aktivasi kode oleh /api/aktivasi/route.ts.
-- UUID-nya disimpan di cookie owner_id (client-side).
-- Tidak ada auth_id — tidak ada Supabase Auth.
-- Tidak ada login screen — owner langsung masuk setelah aktivasi.
--
-- Kenapa tabel ini masih ada meski owner-only?
--   Karena enam kolom di tabel lain FK ke users.id:
--   menu_item.updated_by, diskon_preset.updated_by,
--   promo_rule.updated_by, transaksi.kasir_id,
--   transaksi.void_by, transaction_items (tidak langsung tapi via transaksi)
--   Menghapus tabel ini = rewrite schema masif. Tidak worth it.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id    UUID NOT NULL,
    username   TEXT NOT NULL,
    role       role_enum NOT NULL DEFAULT 'owner',
    -- Selalu 'owner'. role kasir tidak pernah dipakai di schema ini.
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (umkm_id, username),
    CHECK (username <> '')
);

-- KOLOM YANG SENGAJA TIDAK ADA (berbeda dari V2):
--   auth_id      → tidak ada Supabase Auth
--   last_login_at → tidak ada login screen


-- ============================================================
-- STEP 4: KATEGORI
-- Soft delete via is_active = FALSE.
-- menu_item.kategori_id ON DELETE SET NULL — aman hapus kategori.
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
-- Tulang punggung sistem.
-- TIDAK PERNAH hard delete — gunakan is_active = FALSE.
--
-- is_active  = apakah item masih dijual (owner control, permanen)
-- is_available = apakah stok ada hari ini (owner toggle harian)
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_item (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id      UUID NOT NULL,
    kategori_id  UUID REFERENCES kategori(id) ON DELETE SET NULL,
    nama         TEXT NOT NULL,
    harga        NUMERIC(12,2) NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    urutan       INTEGER NOT NULL DEFAULT 0,
    updated_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (harga >= 0),
    CHECK (nama <> '')
);


-- ============================================================
-- STEP 6: DISKON PRESET
-- Owner buat preset. Di kasir, hanya bisa pilih dari sini.
-- Tidak ada input nominal bebas — by design.
-- NUMERIC(5,2) agar support 12.5%.
-- Di-seed 4 default (5%, 10%, 15%, 20%) saat aktivasi.
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
-- AKTIF di schema ini (berbeda dari V1 yang ada tapi tidak dipakai).
-- Engine: src/lib/cart/promo-engine.ts
-- UI: src/app/pengaturan/promo/page.tsx
--
-- qty_beli dan qty_gratis otomatis dari tipe_promo:
--   bogo     → qty_beli=1, qty_gratis=1
--   buy2get1 → qty_beli=2, qty_gratis=1
--
-- KNOWN LIMITATION KL-01:
--   Overlap periode untuk item+tipe yang sama tidak dicegah di DB.
--   UNIQUE(umkm_id, menu_item_id, tipe_promo) mencegah duplikasi tipe,
--   tapi tidak mencegah overlap waktu.
--   Application layer (promo-rule.ts) yang harus cek sebelum INSERT.
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
    berlaku_sampai TIMESTAMPTZ DEFAULT NULL,
    -- NULL = tidak ada batas waktu
    updated_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (qty_beli > 0),
    CHECK (qty_gratis > 0),
    CHECK (qty_gratis < qty_beli),
    CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai),

    UNIQUE (umkm_id, menu_item_id, tipe_promo)
);


-- ============================================================
-- STEP 8: TRANSAKSI (header)
-- Satu row per transaksi.
-- grand_total TIDAK dikirim dari UI — dihitung server, di-enforce trigger.
--
-- Cash reconciliation:
--   uang_diterima dan kembalian wajib ada untuk payment_method = 'cash'.
--   Rekonsiliasi: SUM(uang_diterima) - SUM(kembalian) = uang di laci.
--
-- Void/refund trail:
--   void_by, void_at, void_reason wajib ada untuk status void/refund.
--   Tidak pernah NULL kalau status bukan 'completed'.
-- ============================================================

CREATE TABLE IF NOT EXISTS transaksi (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id          UUID NOT NULL,
    nomor_order      TEXT NOT NULL,
    -- Format: YYYYMMDD-XXXX — di-generate server via generate_nomor_order()
    status           transaksi_status_enum NOT NULL DEFAULT 'completed',
    diskon_preset_id UUID REFERENCES diskon_preset(id),
    -- NULL = tidak ada diskon level transaksi
    payment_method   payment_method_enum NOT NULL,
    grand_total      NUMERIC(12,2) NOT NULL,

    -- Cash reconciliation
    uang_diterima    NUMERIC(12,2),
    -- NOT NULL kalau payment_method = 'cash'
    kembalian        NUMERIC(12,2),
    -- NOT NULL kalau payment_method = 'cash'

    kasir_id         UUID NOT NULL REFERENCES users(id),
    -- Selalu owner UUID (dari cookie owner_id). Tidak ada kasir lain.

    -- Void / refund audit trail
    void_by          UUID REFERENCES users(id),
    void_at          TIMESTAMPTZ,
    void_reason      TEXT,

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
-- SNAPSHOT PERMANEN — tidak boleh diubah setelah INSERT.
-- Immutable by design: nama_produk, harga_satuan, qty, diskon_persen, final_price_item.
--
-- item_type:
--   normal     → tidak ada diskon, bukan promo
--   discounted → ada diskon dari preset
--   promo_free → item gratis dari BOGO (aktif di schema ini)
--
-- triggered_by_item_id:
--   NULL untuk item normal dan discounted.
--   NOT NULL untuk item promo_free — menunjuk ke item pemicunya
--   dalam transaksi yang sama.
--
-- Formula final_price_item (TIDAK BOLEH BERUBAH):
--   ROUND(harga_satuan × qty × (1 - diskon_persen / 100), 0)
--   Aturan: kalikan dulu, bulatkan sekali. Round half up.
--   Item promo_free: final_price_item = 0 (dipaksa server dan CHECK).
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_id         UUID NOT NULL REFERENCES transaksi(id),
    menu_item_id         UUID REFERENCES menu_item(id),
    -- Nullable: FK nullable karena menu_item tidak pernah hard delete.
    -- Kalau menu_item suatu saat di-drop (tidak seharusnya), riwayat tidak rusak.
    umkm_id              UUID NOT NULL,
    -- Denormalisasi untuk performa query rekap tanpa JOIN ke transaksi.

    -- Snapshot permanen — immutable setelah INSERT
    nama_produk          TEXT NOT NULL,
    harga_satuan         NUMERIC(12,2) NOT NULL,
    qty                  INTEGER NOT NULL,
    item_type            item_type_enum NOT NULL,

    -- Diskon — hanya dari preset
    diskon_persen        NUMERIC(5,2) NOT NULL DEFAULT 0,
    diskon_preset_id     UUID REFERENCES diskon_preset(id),

    -- BOGO link
    triggered_by_item_id UUID REFERENCES transaction_items(id),
    -- NULL untuk normal/discounted. NOT NULL untuk promo_free.

    -- Hasil akhir — SELALU dihitung server
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
-- Enforcement terakhir di database layer.
-- Berlaku untuk semua transaksi, semua item_type.
-- Kalau tidak cocok → RAISE EXCEPTION → seluruh batch di-rollback.
-- DEFERRABLE INITIALLY DEFERRED agar bisa check setelah semua items di-INSERT.
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
-- Memastikan item promo_free tidak bisa pointing ke item di transaksi lain.
-- Langsung return NEW kalau triggered_by_item_id = NULL (item normal/discounted).
-- ============================================================

CREATE OR REPLACE FUNCTION check_triggered_by_same_transaction()
RETURNS TRIGGER AS $$
DECLARE
    source_transaksi_id UUID;
BEGIN
    -- NULL = bukan item promo. Skip.
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
-- Format: YYYYMMDD-XXXX (zona Jakarta)
-- Contoh: 20250529-0001, 20250529-0042
-- Reset setiap hari.
--
-- KNOWN LIMITATION KL-03:
--   SELECT MAX+1 aman untuk single kasir (owner-only).
--   Tidak ada concurrent INSERT karena hanya satu pengguna.
--   Kalau di masa depan ada kasir kedua → harus ganti ke sequence.
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

-- Rekap dan filter transaksi
CREATE INDEX IF NOT EXISTS idx_transaksi_umkm_status_created
    ON transaksi (umkm_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaksi_kasir
    ON transaksi (kasir_id);

CREATE INDEX IF NOT EXISTS idx_transaksi_nomor_order
    ON transaksi (umkm_id, nomor_order);

-- Item transaksi
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaksi
    ON transaction_items (transaksi_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_menu
    ON transaction_items (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_item_type
    ON transaction_items (umkm_id, item_type);

-- Menu
CREATE INDEX IF NOT EXISTS idx_menu_item_umkm_active
    ON menu_item (umkm_id, is_active, is_available);

-- Kategori
CREATE INDEX IF NOT EXISTS idx_kategori_umkm
    ON kategori (umkm_id, is_active);

-- Diskon preset
CREATE INDEX IF NOT EXISTS idx_diskon_preset_umkm_active
    ON diskon_preset (umkm_id, is_active);

-- Promo rule (lookup saat kasir load)
CREATE INDEX IF NOT EXISTS idx_promo_rule_menu_active
    ON promo_rule (menu_item_id, is_active, berlaku_mulai, berlaku_sampai);

CREATE INDEX IF NOT EXISTS idx_promo_rule_umkm
    ON promo_rule (umkm_id, is_active);

-- Users (lookup owner_id dari cookie)
CREATE INDEX IF NOT EXISTS idx_users_umkm_active
    ON users (umkm_id, is_active);

-- INDEX YANG SENGAJA TIDAK ADA (berbeda dari V2):
--   idx_users_auth_id               → tidak ada auth_id
--   idx_transaksi_kasir_status_created → tidak perlu laporan per kasir


-- ============================================================
-- STEP 14: SEED — kode aktivasi untuk testing
-- Diskon preset default TIDAK di-seed di sini.
-- Di-seed via application layer (/api/aktivasi/route.ts)
-- saat owner aktivasi kode pertama kali.
-- ============================================================

INSERT INTO aktivasi_kode (kode, version_access) VALUES
    ('UMKM-MAMTA-01', 'v1'),
    ('UMKM-PILOT-02', 'v1'),
    ('UMKM-TEST-03',  'v1'),
    ('UMKM-DEV-04',   'v1')
ON CONFLICT (kode) DO NOTHING;


-- ============================================================
-- STEP 15: RLS — DISABLED
-- Alasan: tidak ada Supabase Auth, tidak ada JWT.
-- Isolasi tenant dijaga via .eq('umkm_id', ...) di setiap query.
-- ============================================================

-- Semua tabel defaultnya RLS = OFF di PostgreSQL.
-- Tidak perlu eksplisit di-disable.
-- UTANG TEKNIS: kalau suatu saat ada multi-tenant production,
-- aktifkan RLS dengan Supabase Auth (lihat V2 migration sebagai referensi).


-- ============================================================
-- RINGKASAN FITUR AKTIF
-- ============================================================
--
-- AKTIF (application layer menggunakannya):
--   ✓ item_type: 'normal', 'discounted', 'promo_free'
--   ✓ payment_method: 'cash', 'qris', 'transfer', 'debit'
--   ✓ status: 'completed', 'void', 'refund'
--   ✓ role: 'owner' (satu user per UMKM, di-seed saat aktivasi)
--   ✓ diskon_preset (CRUD + seed default 4 preset)
--   ✓ promo_rule (BOGO + Buy2Get1)
--   ✓ promo-engine.ts (triggered_by_item_id)
--   ✓ generate_nomor_order()
--   ✓ Trigger check_grand_total
--   ✓ Trigger check_triggered_by_same_transaction
--
-- TIDAK ADA (dihapus dari V2, tidak masuk schema ini):
--   ✗ auth_id di users
--   ✗ last_login_at di users
--   ✗ role: 'kasir'
--   ✗ Supabase Auth integration
--   ✗ RLS / JWT policy
--   ✗ get_umkm_id_from_jwt()
--   ✗ get_current_user_id()
--   ✗ is_owner()
--   ✗ idx_users_auth_id
--   ✗ idx_transaksi_kasir_status_created


-- ============================================================
-- KNOWN LIMITATIONS
-- ============================================================
-- KL-01: Overlap promo aktif untuk item yang sama tidak dicegah DB.
--        UNIQUE(umkm_id, menu_item_id, tipe_promo) mencegah tipe yang
--        sama, tapi tidak mencegah overlap periode.
--        → Application layer cek sebelum INSERT promo_rule baru.
--
-- KL-02: is_available tidak ada auto-reset harian ke TRUE.
--        Toggle manual oleh owner. Kalau lupa → item tidak muncul.
--        → Solusi masa depan: scheduled function reset harian.
--
-- KL-03: generate_nomor_order pakai SELECT MAX+1.
--        Aman karena single owner, tidak ada concurrent INSERT.
--        → Harus diganti ke sequence kalau suatu saat ada kasir kedua.
--
-- KL-04: RLS disabled. Wajib .eq('umkm_id', ...) di setiap query.
--        Kalau satu query lupa filter → data UMKM lain bisa bocor.
--        → Konsekuensi diterima karena tidak ada multi-user.
--
-- KL-05: triggered_by_item_id dijaga trigger, bukan FK constraint.
--        Operasi bulk yang bypass trigger = integritas bisa rusak.
--        → Semua operasi lewat application layer normal.
--
-- KL-06: Import restore tidak validasi ulang grand_total konsistensi.
--        File backup berasal dari export yang sudah valid → diterima.


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
-- Expected: trg_validate_grand_total, trg_validate_triggered_by_same_transaction

-- 3. Functions (harus 3):
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- ORDER BY routine_name;
-- Expected: check_grand_total, check_triggered_by_same_transaction, generate_nomor_order

-- 4. RLS harus OFF semua:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- Semua kolom rowsecurity harus = false

-- 5. Users: kolom auth_id dan last_login_at TIDAK ADA:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users' AND table_schema = 'public'
-- ORDER BY ordinal_position;
-- Harus ADA: id, umkm_id, username, role, is_active, created_at, updated_at
-- Harus TIDAK ADA: auth_id, last_login_at