-- ============================================================
--  POS UMKM MVP — Skema Database Supabase (PostgreSQL)
--  Jalankan seluruh isi file ini di Supabase → SQL Editor.
--  Tidak ada RLS (MVP). Scoping multi-tenant via kolom umkm_id.
-- ============================================================

-- 1) Kode aktivasi --------------------------------------------------
CREATE TABLE IF NOT EXISTS aktivasi_kode (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kode TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  umkm_id UUID DEFAULT NULL,
  version_access TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ DEFAULT NULL
);

-- 2) Konfigurasi / profil UMKM -------------------------------------
CREATE TABLE IF NOT EXISTS umkm_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  umkm_id UUID UNIQUE NOT NULL,
  nama_umkm TEXT NOT NULL DEFAULT '',
  alamat TEXT DEFAULT '',
  no_telp TEXT DEFAULT '',
  footer_struk TEXT DEFAULT '',
  app_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Kategori -------------------------------------------------------
CREATE TABLE IF NOT EXISTS kategori (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  umkm_id UUID NOT NULL,
  nama TEXT NOT NULL,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Item menu ------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  umkm_id UUID NOT NULL,
  kategori_id UUID REFERENCES kategori(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  harga INTEGER NOT NULL,
  tersedia BOOLEAN DEFAULT TRUE,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Transaksi (header) --------------------------------------------
CREATE TABLE IF NOT EXISTS transaksi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  umkm_id UUID NOT NULL,
  nomor_order INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  subtotal INTEGER NOT NULL,
  diskon_persen INTEGER DEFAULT 0,
  diskon_nominal INTEGER DEFAULT 0,
  grand_total INTEGER NOT NULL,
  metode_bayar TEXT DEFAULT 'tunai',
  catatan TEXT DEFAULT ''
);

-- 6) Item transaksi (SNAPSHOT — jangan JOIN ke menu_item utk laporan)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaksi_id UUID NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  umkm_id UUID NOT NULL,
  menu_item_id UUID DEFAULT NULL,
  nama_produk TEXT NOT NULL,
  harga_satuan INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  diskon_persen INTEGER DEFAULT 0,
  diskon_nominal INTEGER DEFAULT 0,
  subtotal_item INTEGER NOT NULL,
  final_price_item INTEGER NOT NULL
);

-- 7) Indexes --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transaksi_umkm_timestamp ON transaksi(umkm_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_transaksi_id ON transaction_items(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_items_umkm_produk ON transaction_items(umkm_id, nama_produk);
CREATE INDEX IF NOT EXISTS idx_menu_umkm ON menu_item(umkm_id);
CREATE INDEX IF NOT EXISTS idx_kategori_umkm ON kategori(umkm_id);

-- 8) Kode test (ganti / tambah sesuai kebutuhan) -------------------
INSERT INTO aktivasi_kode (kode) VALUES
  ('UMKM-MAMTA-01'),
  ('UMKM-PILOT-02'),
  ('UMKM-TEST-03')
ON CONFLICT (kode) DO NOTHING;

-- ----------------------------------------------------------------
--  Util: reset sebuah device/kode
--  UPDATE aktivasi_kode SET used=FALSE, umkm_id=NULL, activated_at=NULL
--  WHERE kode = 'UMKM-MAMTA-01';
-- ----------------------------------------------------------------
