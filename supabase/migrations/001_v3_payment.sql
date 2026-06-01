-- ============================================================================
-- V3 Payment Infrastructure — migrasi tabel.
-- Jalankan di Supabase SQL editor (atau supabase db push). Idempoten via IF NOT EXISTS.
-- Prasyarat: tabel `transaksi` sudah ada (untuk FK), ekstensi pgcrypto aktif
-- (Supabase: gen_random_uuid tersedia secara default).
-- ============================================================================

-- ── pg_credentials ───────────────────────────────────────────────────────────
create table if not exists pg_credentials (
  id            uuid primary key default gen_random_uuid(),
  umkm_id       uuid not null,
  provider      text not null check (provider in ('xendit','midtrans','doku')),
  key_ciphertext text not null,
  key_iv        text not null,
  key_auth_tag  text not null,
  mode          text not null default 'sandbox' check (mode in ('sandbox','production')),
  is_active     boolean not null default false,
  webhook_token text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (umkm_id, provider)
);

-- Maksimal SATU credential aktif per tenant.
create unique index if not exists pg_credentials_one_active
  on pg_credentials (umkm_id) where is_active;

-- ── payment_session ──────────────────────────────────────────────────────────
create table if not exists payment_session (
  id            uuid primary key default gen_random_uuid(),
  umkm_id       uuid not null,
  provider      text not null,
  external_id   text not null,
  qr_string     text not null,
  qr_url        text,
  amount        integer not null,
  kasir_id      uuid,
  status        text not null default 'pending'
                  check (status in ('pending','paid','expired','failed')),
  cart_snapshot jsonb not null,
  transaksi_id  uuid references transaksi(id) on delete set null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists payment_session_external
  on payment_session (provider, external_id);

-- Idempotency (R6): maksimal SATU session pending per tenant.
create unique index if not exists payment_session_one_pending
  on payment_session (umkm_id) where status = 'pending';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Tanpa policy untuk anon → default DENY. service_role (server) bypass RLS.
alter table pg_credentials enable row level security;
alter table payment_session enable row level security;

-- ── Catatan Phase 0 / S1 (lakukan terpisah bila belum) ───────────────────────
-- Untuk memenuhi R3 sepenuhnya, write `transaksi`/`transaction_items` juga harus
-- pindah ke API route service-role + RLS, dan grant anon dicabut. Itu di luar
-- migrasi ini, tapi WAJIB sebelum produksi. Contoh:
--   revoke insert, update, delete on transaksi from anon;
--   revoke insert, update, delete on transaction_items from anon;
--   alter table transaksi enable row level security;
--   alter table transaction_items enable row level security;
