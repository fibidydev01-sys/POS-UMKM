-- ============================================================
-- UNIVERSAL CLEAN SLATE — PostgreSQL / Supabase
-- Drop SEMUA objects di schema public:
--   triggers, functions, tables, views, sequences,
--   types, extensions (opsional)
-- PERINGATAN: TIDAK BISA DI-UNDO — pastikan sudah backup
-- ============================================================


-- ============================================================
-- STEP 1: DROP semua TABLES (CASCADE otomatis handle FK + triggers)
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;


-- ============================================================
-- STEP 2: DROP semua VIEWS
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;


-- ============================================================
-- STEP 3: DROP semua FUNCTIONS & PROCEDURES
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;


-- ============================================================
-- STEP 4: DROP semua SEQUENCES
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT sequencename
        FROM pg_sequences
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
END $$;


-- ============================================================
-- STEP 5: DROP semua ENUM TYPES & COMPOSITE TYPES
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname
        FROM pg_type t
        JOIN pg_namespace ns ON ns.oid = t.typnamespace
        WHERE ns.nspname = 'public'
          AND t.typtype IN ('e', 'c')  -- e = enum, c = composite
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;


-- ============================================================
-- STEP 6: DROP semua EXTENSIONS (opsional — uncomment jika perlu)
-- Hati-hati: ekstensi seperti uuid-ossp / pgcrypto mungkin dipakai Supabase internal
-- ============================================================

-- DO $$ DECLARE
--     r RECORD;
-- BEGIN
--     FOR r IN (
--         SELECT extname
--         FROM pg_extension
--         WHERE extname NOT IN ('plpgsql')  -- jangan drop plpgsql, itu core
--     ) LOOP
--         EXECUTE 'DROP EXTENSION IF EXISTS ' || quote_ident(r.extname) || ' CASCADE';
--     END LOOP;
-- END $$;


-- ============================================================
-- SELESAI — schema public kosong bersih
-- Siap jalankan SQL schema baru apapun
-- ============================================================