-- ============================================================
-- POS UMKM — Migration 3.0 → 3.1
-- Jalankan ini HANYA jika schema 3.0 sudah di-deploy sebelumnya.
-- Kalau fresh install: jalankan schema.sql saja, file ini tidak perlu.
-- ============================================================
-- Aman dijalankan berulang kali.
-- ============================================================

-- ── FIX-01: promo_rule BOGO constraint ───────────────────────
-- Bug: CHECK (qty_gratis < qty_beli) memblok BOGO (qty_beli=1, qty_gratis=1)
-- Fix: ganti ke <= agar BOGO bisa INSERT
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'promo_rule'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%qty_gratis < qty_beli%';

    IF v_constraint IS NOT NULL THEN
        EXECUTE 'ALTER TABLE promo_rule DROP CONSTRAINT ' || quote_ident(v_constraint);
        ALTER TABLE promo_rule
            ADD CONSTRAINT promo_rule_qty_gratis_lte_beli
            CHECK (qty_gratis <= qty_beli);
        RAISE NOTICE 'FIX-01 applied: promo_rule qty_gratis <= qty_beli';
    ELSE
        RAISE NOTICE 'FIX-01 skipped: constraint not found (already fixed or fresh install)';
    END IF;
END $$;


-- ── FIX-02: transaction_items discounted constraint ──────────
-- Bug: AND diskon_preset_id IS NOT NULL memblok V1 ENV mode
--      (hardcoded preset = preset_id null)
-- Fix: hapus syarat preset_id, cukup diskon_persen > 0
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'transaction_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%diskon_preset_id IS NOT NULL%';

    IF v_constraint IS NOT NULL THEN
        EXECUTE 'ALTER TABLE transaction_items DROP CONSTRAINT ' || quote_ident(v_constraint);
        ALTER TABLE transaction_items
            ADD CONSTRAINT transaction_items_discounted_persen_check
            CHECK (item_type <> 'discounted' OR diskon_persen > 0);
        RAISE NOTICE 'FIX-02 applied: transaction_items discounted preset optional';
    ELSE
        RAISE NOTICE 'FIX-02 skipped: constraint not found (already fixed or fresh install)';
    END IF;
END $$;


-- ── Verifikasi ───────────────────────────────────────────────
-- Jalankan query ini setelah migration untuk konfirmasi:

-- FIX-01 berhasil jika kolom def mengandung <=:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'promo_rule'::regclass AND contype = 'c'
--   AND pg_get_constraintdef(oid) LIKE '%qty_gratis%';

-- FIX-02 berhasil jika tidak ada diskon_preset_id IS NOT NULL:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'transaction_items'::regclass AND contype = 'c'
--   AND pg_get_constraintdef(oid) LIKE '%discounted%';
