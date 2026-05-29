# POS UMKM — Implementation Phases V2
**Scope:** Multi-user (owner + kasir), promo otomatis, RLS proper.
**Prerequisite:** V1 harus 100% selesai dan production-stable sebelum V2 dimulai.
**Prinsip Opus:** Setiap phase V2 adalah additive — tidak boleh break fitur V1 yang sudah jalan.
**DB:** Schema tidak berubah. V2 mengaktifkan fitur yang sudah di-schema tapi belum dipakai V1.

---

## Urutan Dependency V2

V2 punya dependency chain yang ketat. Tidak bisa dikerjakan paralel sembarangan:

```
Phase 1 (Auth)
    ↓
Phase 2 (RLS)     ← butuh auth selesai
    ↓
Phase 3 (Users CRUD)  ← butuh auth + RLS
    ↓
Phase 4 (Kasir Login)  ← butuh users CRUD
    ↓
Phase 5 (Role-based UI)  ← butuh kasir login
    ↓
Phase 6 (Promo Engine)   ← bisa paralel dengan 3-5 tapi butuh auth
    ↓
Phase 7 (Promo UI)  ← butuh promo engine
    ↓
Phase 8 (Payment debit+transfer)  ← bisa dikerjakan kapanpun setelah Phase 5
    ↓
Phase 9 (Refund)  ← butuh kasir login + role check
    ↓
Phase 10 (Laporan per kasir)  ← butuh kasir login + transaksi V2 data
```

---

## Phase 1 — Auth Layer: Supabase Auth Integration
**Deliverable:** Setiap pengguna (owner dan kasir) punya session Supabase Auth yang valid. Cookie `umkm_id` digantikan oleh JWT. `owner_id` cookie dihapus — identitas sekarang dari session.

**Ini adalah perubahan paling fundamental di V2.** Semua phase lain bergantung padanya.

### Keputusan Desain Auth
Supabase Auth pakai email/password secara default. Untuk konteks UMKM, username + PIN lebih intuitif. Ada dua opsi:

**Opsi A — Supabase Auth dengan email dummy:**
Format email: `{username}@{umkm_id}.pos` — tidak nyata, tapi valid untuk Supabase Auth. Password = PIN 6 digit.
Pro: Pakai semua fitur Supabase Auth (refresh token, RLS JWT, session management).
Con: Username asli ter-obscure di email.

**Opsi B — Custom auth table + JWT manual:**
Tabel `users` sudah ada. Simpan password hash (bcrypt), generate JWT sendiri di server.
Pro: Kontrol penuh, username langsung tanpa transform.
Con: Harus manage token refresh, tidak dapat fitur Supabase Auth lainnya.

**Rekomendasi:** Opsi A. Supabase Auth jauh lebih aman dan maintainable untuk jangka panjang. Username asli bisa disimpan di `users.username` dan ditampilkan di UI — email dummy hanya dipakai internal auth.

### File Baru
**`src/app/api/auth/login/route.ts`**
- `POST { umkm_id, username, pin }` → sign in ke Supabase Auth dengan email `{username}@{umkm_id}.pos`
- Return session token, set cookie Supabase Auth
- Error handling: user tidak ditemukan, PIN salah, akun nonaktif

**`src/app/api/auth/logout/route.ts`**
- `POST` → sign out dari Supabase Auth, clear semua cookie

**`src/app/login/page.tsx`**
- Form: pilih UMKM (dari cookie `umkm_id` yang masih ada) + username + PIN
- Untuk owner pertama kali: redirect dari aktivasi ke sini
- Tombol "Lupa PIN" — untuk V2 ini tampilkan instruksi reset manual (tidak ada email recovery untuk PIN)

**`src/lib/supabase/auth.ts`** (baru)
- `getCurrentUser(): Promise<User | null>` — ambil user dari Supabase session, join ke tabel `users`
- `getSessionUmkmId(): string | null` — extract `umkm_id` dari JWT claim
- `requireAuth(): User` — throw redirect ke `/login` jika tidak ada session

### File Diedit
**`src/lib/supabase/client.ts`**
- Aktifkan `persistSession: true`, `autoRefreshToken: true`
- Hapus konfigurasi yang matikan auth

**`src/lib/supabase/server.ts`**
- Gunakan `createServerClient` dari `@supabase/ssr` (bukan `createClient` biasa)
- Set cookie dari request headers agar session server-side bisa dibaca

**`src/proxy.ts`**
- Ganti cek `umkm_id` cookie dengan cek Supabase session
- Jika tidak ada session: redirect ke `/login`
- Jika ada session tapi `umkm_id` cookie hilang: redirect ke `/aktivasi`

**`src/app/api/aktivasi/route.ts`**
- Setelah seed system user: buat akun Supabase Auth untuk owner dengan email dummy + PIN default (`123456`)
- Tampilkan instruksi di halaman aktivasi step 2: "PIN awal Anda adalah 123456. Ubah segera di Pengaturan."

**`src/lib/utils/umkm-id.ts`**
- `getOwnerId()` dan `clearOwnerId()` — **deprecate** di V2. Identitas dari session, bukan cookie.
- Pertahankan `getUmkmId()` dan `clearUmkmId()` — masih dipakai untuk identifikasi UMKM

### Perubahan di Seluruh Codebase (Sweeping)
Setiap tempat yang memanggil `getOwnerId()` harus diganti dengan `getCurrentUser()`. Ini menyentuh:
- `src/app/kasir/page.tsx`
- `src/app/menu/page.tsx`
- `src/app/pengaturan/diskon/page.tsx`
- Semua fungsi di `src/lib/db/*.ts` yang terima `ownerId` parameter

### Definisi Selesai
- Owner bisa login dengan username "owner" + PIN
- Session persists across page refresh
- Logout berhasil clear semua auth state
- Aktivasi kode baru otomatis setup akun login owner

---

## Phase 2 — RLS: Re-enable dengan JWT
**Deliverable:** Semua tabel kembali pakai RLS. Isolasi tenant dijamin DB, bukan application layer.

**Prerequisite:** Phase 1 selesai dan stabil. Jangan enable RLS sebelum auth jalan.

### SQL Migration (bukan code)
```sql
-- Update semua policy dari app.current_umkm_id ke auth.jwt()
-- Jalankan di Supabase SQL Editor

-- 1. Hapus policy lama
DROP POLICY IF EXISTS umkm_isolation ON menu_item;
DROP POLICY IF EXISTS umkm_isolation ON kategori;
DROP POLICY IF EXISTS umkm_isolation ON diskon_preset;
DROP POLICY IF EXISTS umkm_isolation ON promo_rule;
DROP POLICY IF EXISTS umkm_isolation ON transaksi;
DROP POLICY IF EXISTS umkm_isolation ON transaction_items;
DROP POLICY IF EXISTS umkm_isolation ON users;

-- 2. Buat policy baru berbasis JWT claim
-- Setiap user Supabase Auth harus punya metadata umkm_id
-- Set saat create user: auth.admin.updateUser({ user_metadata: { umkm_id: '...' } })

CREATE POLICY umkm_isolation ON menu_item
    USING ((auth.jwt() -> 'user_metadata' ->> 'umkm_id')::uuid = umkm_id);

-- (ulangi untuk semua tabel)

-- 3. Re-enable RLS
ALTER TABLE menu_item         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori          ENABLE ROW LEVEL SECURITY;
ALTER TABLE diskon_preset     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_rule        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
```

### File Diedit
**`src/app/api/aktivasi/route.ts`**
- Saat buat akun Supabase Auth untuk owner: set `user_metadata: { umkm_id, role: 'owner' }`

**`src/app/api/auth/login/route.ts`**
- Setelah login berhasil, verifikasi bahwa JWT punya `umkm_id` di metadata
- Jika tidak ada (akun lama sebelum V2): update metadata via Supabase Admin

**Seluruh `src/lib/db/*.ts`**
- Hapus semua `.eq('umkm_id', ...)` yang sekarang redundan
- RLS di DB yang akan filter — application code tidak perlu filter manual lagi
- Ini adalah cleanup yang significant tapi tidak mengubah logic

### Catatan Penting
Penghapusan `.eq('umkm_id', ...)` harus dilakukan setelah dipastikan RLS berjalan benar di semua tabel. Jangan hapus filter manual sebelum test RLS dengan akun yang berbeda. Strategi aman: hapus satu tabel dulu, test, baru lanjut.

### Definisi Selesai
- Bisa login dengan dua akun UMKM berbeda di dua browser: data tidak saling kelihatan
- Jika JWT tidak ada atau expired: semua query return kosong (bukan error 403)

---

## Phase 3 — Users CRUD: Manajemen Kasir
**Deliverable:** Owner bisa tambah akun kasir, set PIN, dan nonaktifkan kasir dari halaman pengaturan.

**Prerequisite:** Phase 1 (auth) dan Phase 2 (RLS) selesai.

### File Diedit
**`src/lib/db/users.ts`**
Tambah fungsi yang belum ada di V1:
- `getUsers(umkmId): Promise<User[]>` — semua user aktif, urut `created_at ASC`
- `tambahUser(umkmId, input: UserInput, currentUserId): Promise<User>` — insert ke `users` tabel + buat akun Supabase Auth dengan email dummy + PIN default
- `updateUser(id, input: UserInput, currentUserId): Promise<void>` — update nama, role
- `resetPin(userId, newPin): Promise<void>` — update password di Supabase Auth
- `nonaktifkanUser(id): Promise<void>` — `is_active = false` di `users` + disable di Supabase Auth

`UserInput` untuk V2: `{ username: string, role: 'kasir' | 'owner' }`

### File Baru
**`src/components/pengaturan/user-list.tsx`**
- List semua user aktif dengan badge role (Owner / Kasir)
- Tombol edit per user
- Tombol "Tambah Kasir"

**`src/components/pengaturan/form-user.tsx`**
- Dialog: input username, pilih role, tombol simpan
- Mode tambah: PIN default otomatis, tampilkan ke owner sekali
- Mode edit: tidak bisa edit username (identifier), bisa ganti role
- Tombol "Reset PIN": set ke PIN baru yang diinput owner

**`src/app/pengaturan/users/page.tsx`**
- Halaman full daftar user + aksi
- Validasi: tidak bisa nonaktifkan diri sendiri
- Validasi: harus ada minimal 1 owner aktif

### File Diedit
**`src/app/pengaturan/page.tsx`**
- Tambah card "Kelola Kasir" dengan link ke `/pengaturan/users`

### Definisi Selesai
- Owner bisa tambah kasir dengan PIN yang bisa di-reset
- Kasir yang dinonaktifkan tidak bisa login
- Minimal 1 owner aktif dijaga di validasi

---

## Phase 4 — Kasir Login: Session per User
**Deliverable:** Setiap sesi punya identitas user yang jelas. `kasir_id` di transaksi mencerminkan siapa yang sedang jaga kasir, bukan system user.

**Prerequisite:** Phase 3 selesai.

### File Baru
**`src/app/login/page.tsx`** (sudah di-scaffold Phase 1, sekarang final)
- Tampilkan nama UMKM dari cookie `umkm_id` (bukan input ulang)
- Input username + PIN (6 digit, keyboard numeric)
- Tidak ada "ingat saya" — session otomatis persists via Supabase Auth
- Error state: "Username atau PIN salah"

### File Diedit
**`src/app/kasir/page.tsx`**
- `kasir_id` tidak lagi dari `getOwnerId()` — dari `getCurrentUser().id`
- Tampilkan nama kasir yang sedang login di header kasir page

**`src/app/pengaturan/page.tsx`**
- Tampilkan "Login sebagai: {username}" di bagian info
- Tombol "Ganti Kasir" → logout dan redirect ke login
- Tombol "Keluar" tetap ada (logout penuh)

### Definisi Selesai
- Transaksi baru punya `kasir_id` yang bermakna
- Jika kasir ganti shift: logout, login dengan akun berbeda
- History transaksi menampilkan nama kasir (join dari `users` table)

---

## Phase 5 — Role-Based UI: Beda Akses Owner vs Kasir
**Deliverable:** Kasir hanya bisa akses halaman kasir dan riwayat. Halaman pengaturan, menu edit, dan dashboard hanya untuk owner.

**Prerequisite:** Phase 4 selesai.

### Logika Akses
```
Owner: semua halaman
Kasir: /kasir, /riwayat (read only — tidak ada void)
Kasir TIDAK bisa: /menu, /dashboard, /pengaturan, void transaksi
```

### File Diedit
**`src/proxy.ts`**
- Setelah auth check: baca `role` dari user session
- Jika role `'kasir'` dan path di luar whitelist kasir: redirect ke `/kasir`

**`src/components/shared/bottom-nav.tsx`**
- Terima prop `role` atau baca dari context
- Kasir: tampilkan hanya tab Kasir dan Riwayat
- Owner: tampilkan semua tab (tidak berubah dari V1)

**`src/app/riwayat/page.tsx`**
- Tombol "Void": hanya muncul jika `role === 'owner'`
- Kasir bisa lihat riwayat tapi tidak bisa void

**`src/app/kasir/page.tsx`**
- Tidak ada perubahan fungsional — kasir punya akses penuh ke kasir page

### Definisi Selesai
- Kasir tidak bisa navigasi ke halaman owner via URL langsung (protected by proxy)
- Kasir tidak melihat tab yang tidak relevan

---

## Phase 6 — Promo Engine: BOGO + Buy2Get1
**Deliverable:** Saat item dengan promo aktif ditambah ke keranjang, item gratis otomatis muncul. Tidak perlu aksi kasir.

**Prerequisite:** Phase 1 (auth) untuk `updated_by`. Bisa dikerjakan paralel dengan Phase 3-5.

### Desain Promo Engine
```
Input: CartItem[], PromoRule[]
Output: CartItem[]  ← CartItem yang sama + item gratis yang ditambahkan otomatis
```

Aturan:
- BOGO (`qty_beli=1, qty_gratis=1`): setiap 2 unit → 1 unit gratis. Contoh: beli 3 = 2 bayar + 1 gratis. Beli 4 = 3 bayar + 1 gratis. Beli 5 = 4 bayar + 1 gratis (BUKAN 3+2 karena qty_gratis < qty_beli).
- Buy2Get1 (`qty_beli=2, qty_gratis=1`): setiap 3 unit → 1 gratis. Beli 3 = 2 bayar + 1 gratis. Beli 6 = 4 bayar + 2 gratis.
- Formula umum: `jumlah_gratis = Math.floor(qty_total / (qty_beli + qty_gratis))`
- Item gratis: `item_type = 'promo_free'`, `final_price_item = 0`
- Engine di-run setiap kali cart berubah (useEffect di kasir page)
- Engine pure function: tidak ada side effects, tidak ada IO

### File Baru
**`src/lib/db/promo-rule.ts`**
- Interface `PromoRule`: `{ id, umkm_id, menu_item_id, tipe_promo, qty_beli, qty_gratis, is_active, berlaku_mulai, berlaku_sampai, updated_by }`
- `getPromoAktif(umkmId): Promise<PromoRule[]>` — filter: `is_active=true`, `berlaku_mulai <= now()`, `(berlaku_sampai IS NULL OR berlaku_sampai > now())`
- `tambahPromoRule(umkmId, input, ownerId): Promise<void>`
- `updatePromoRule(id, input, ownerId): Promise<void>`
- `hapusPromoRule(id): Promise<void>` — soft delete: `is_active = false`

**`src/lib/cart/promo-engine.ts`**
- `applyPromo(cart: CartItem[], rules: PromoRule[]): CartItem[]`
- Logic: untuk setiap item di cart yang punya promo rule aktif, hitung berapa item gratis, tambahkan ke output array
- Item gratis: copy dari item asli, set `item_type='promo_free'`, `final_price_item=0`, `qty=jumlah_gratis`
- Item yang memicu promo: `item_type` tetap `'normal'` atau `'discounted'` — qty dikurangi qty gratis
- Return cart baru yang sudah include item gratis

### File Diedit
**`src/lib/db/transaksi.ts`**
- `simpanTransaksi` sekarang bisa terima item dengan `item_type='promo_free'`
- Untuk item promo_free: `final_price_item=0`, kirim ke DB
- `triggered_by_item_id`: ini FK ke `transaction_items(id)` — setelah INSERT semua items, UPDATE item gratis dengan `triggered_by_item_id` yang sesuai
- Strategi dua-pass: INSERT semua items dulu tanpa `triggered_by_item_id`, kemudian UPDATE item gratis dengan ID dari item pemicunya

**`src/app/kasir/page.tsx`**
- Load `promoRules` dari `getPromoAktif(umkmId)` di useEffect awal
- Setiap kali `cart` berubah: jalankan `applyPromo(cart, promoRules)` → simpan sebagai `cartWithPromo`
- Tampilkan `cartWithPromo` ke UI, tapi kirim `cartWithPromo` ke `simpanTransaksi`
- Item promo di cart: badge "GRATIS", tidak bisa dihapus manual (hapus item aslinya saja)

### Definisi Selesai
- Beli 2 kopi yang ada BOGO → otomatis 1 kopi gratis di keranjang
- `triggered_by_item_id` terisi benar di DB
- Engine tidak mengubah cart jika tidak ada promo aktif untuk item tersebut

---

## Phase 7 — Promo UI: Halaman Kelola Promo
**Deliverable:** Owner bisa buat, edit, dan hapus promo rule dari halaman pengaturan.

**Prerequisite:** Phase 6 (promo engine + db layer selesai).

### File Baru
**`src/components/pengaturan/form-promo-rule.tsx`**
- Dialog form:
  - Pilih menu item (dropdown dari `getMenuItems`)
  - Pilih tipe: "BOGO (Beli 1 Gratis 1)" atau "Beli 2 Gratis 1"
  - `qty_beli` dan `qty_gratis` auto-fill berdasarkan tipe (owner tidak perlu input manual)
  - Tanggal mulai berlaku (default: hari ini)
  - Tanggal selesai berlaku (opsional — kosong = tidak ada batas)
- Validasi: satu item hanya boleh punya satu tipe promo aktif (cek sebelum submit)

**`src/app/pengaturan/promo/page.tsx`**
- List semua promo rule aktif
- Setiap baris: nama produk, tipe promo, periode berlaku, badge "Aktif"/"Expired"
- Tombol edit dan hapus per baris
- FAB tambah promo baru
- Empty state: "Belum ada promo. Tambah promo untuk menarik pembeli."

### File Diedit
**`src/app/pengaturan/page.tsx`**
- Tambah card "Program Promo" dengan link ke `/pengaturan/promo`
- Tampilkan berapa promo aktif saat ini

### Definisi Selesai
- Owner bisa setup BOGO untuk menu item apapun
- Promo dengan tanggal expired tidak muncul lagi di engine
- Tidak bisa dua promo aktif untuk item yang sama

---

## Phase 8 — Payment Method: Debit + Transfer
**Deliverable:** Kasir bisa pilih Debit atau Transfer sebagai metode pembayaran.

**Prerequisite:** Phase 5 (role-based UI). Bisa dikerjakan setelah Phase 5 selesai.

### Keputusan Desain
- Debit: tidak butuh input nominal tambahan (seperti QRIS)
- Transfer: opsional input nomor referensi transfer (tapi tidak ada di schema — simpan di `void_reason` field atau lewati saja)
- `uang_diterima = null`, `kembalian = null` untuk keduanya (sama seperti QRIS)

### File Diedit
**`src/components/kasir/keranjang-panel.tsx`**
- Tambah 2 tombol payment method: "Debit" dan "Transfer"
- Sekarang ada 4 pilihan: Tunai, QRIS, Debit, Transfer
- Tampilan: grid 2x2 atau row 4 tombol
- Logic uang diterima/kembalian: hanya muncul jika `payment_method === 'cash'`

**`src/app/kasir/page.tsx`**
- State `paymentMethod` sekarang bisa nilai `'debit' | 'transfer'` juga
- Tidak ada perubahan logic `simpanTransaksi` — semua non-cash punya `uang_diterima=null`, `kembalian=null`

### Definisi Selesai
- 4 metode bayar tersedia di UI
- DB menerima semua 4 nilai enum tanpa error

---

## Phase 9 — Refund Flow
**Deliverable:** Owner bisa proses refund — berbeda dari void dalam bahwa refund mencatat uang yang dikembalikan ke pembeli.

**Prerequisite:** Phase 4 (kasir login) dan Phase 5 (role check — hanya owner yang bisa refund).

### Perbedaan Void vs Refund
- **Void**: transaksi dibatalkan, tidak ada uang keluar. Biasanya untuk salah input sebelum pembeli pergi.
- **Refund**: pembeli sudah bayar, lalu minta uang kembali. Ada uang yang harus keluar dari kas.

Schema sudah punya `status='refund'` — semantiknya sama dengan void dari sisi DB, tapi berbeda di laporan.

### File Diedit
**`src/lib/db/transaksi.ts`**
- Tambah `refundTransaksi(id, ownerId, reason): Promise<void>`
- Update: `status='refund'`, `void_by=ownerId`, `void_at=now()`, `void_reason=reason`
- Signature berbeda dari `voidTransaksi` hanya di `status` yang diset

**`src/app/riwayat/page.tsx`**
- Dialog detail transaksi: dua tombol terpisah "Void" dan "Refund"
- Tombol "Refund": wajib input alasan (textarea), konfirmasi nominal yang dikembalikan
- Badge status: "Selesai" (hijau), "Void" (abu), "Refund" (oranye)

**`src/app/dashboard/page.tsx`**
- Tambah card "Total Refund Bulan Ini": jumlah dan nominal
- Query: `status='refund'` terpisah dari void
- Catatan: refund juga tidak masuk omzet (seperti void)

### Definisi Selesai
- Void dan refund dibedakan di UI dan laporan
- Keduanya tidak masuk omzet
- Alasan refund wajib diisi

---

## Phase 10 — Laporan per Kasir
**Deliverable:** Owner bisa lihat omzet dipecah per kasir. Bisa filter dashboard berdasarkan kasir.

**Prerequisite:** Phase 4 selesai dan ada data transaksi V2 yang punya `kasir_id` bermakna.

### File Diedit
**`src/lib/db/transaksi.ts`**
- `getRingkasanPerKasir(umkmId, kasirId, periode): Promise<RingkasanOmzet>` — sama dengan `getRingkasanOmzet` tapi filter tambahan `kasir_id`
- `getTopProdukPerKasir(umkmId, kasirId): Promise<TopProduk[]>`

**`src/app/dashboard/page.tsx`**
- Tambah filter dropdown "Semua Kasir" / per kasir (load dari `getUsers`)
- Jika filter kasir dipilih: semua card statistik menampilkan data kasir itu saja
- Default: "Semua Kasir" (behavior V1)

### Definisi Selesai
- Owner bisa evaluate performa tiap kasir
- Default dashboard tidak berubah dari V1 (semua kasir digabung)

---

## Phase 11 — QA: Acceptance Checklist V2

**Auth + Multi-user:**
- [ ] Aktivasi kode baru: owner akun ter-create dengan PIN default 123456
- [ ] Login owner berhasil, session persist
- [ ] Tambah kasir: login kasir berhasil
- [ ] Kasir tidak bisa akses `/menu`, `/dashboard`, `/pengaturan` via URL langsung
- [ ] Logout: session clear, redirect ke login
- [ ] Nonaktifkan kasir: kasir tidak bisa login lagi

**RLS:**
- [ ] Login dengan UMKM A: tidak melihat data UMKM B
- [ ] Tanpa session: semua query return kosong

**Promo:**
- [ ] Setup BOGO untuk item A
- [ ] Tambah 2x item A ke keranjang: 1 item A gratis otomatis muncul
- [ ] `triggered_by_item_id` di DB terisi benar
- [ ] Tambah 4x item A: 2 bayar + 2 gratis (BOGO tiap 2)
- [ ] Hapus promo: item gratis tidak muncul lagi di keranjang
- [ ] Promo expired: tidak aktif lagi meski `is_active=true`

**Payment debit + transfer:**
- [ ] Pilih Debit: tidak ada input uang diterima, transaksi tersimpan `payment_method='debit'`
- [ ] Pilih Transfer: idem dengan `payment_method='transfer'`

**Refund:**
- [ ] Proses refund: `status='refund'`, badge oranye di riwayat
- [ ] Refund tidak masuk omzet dashboard
- [ ] Kasir tidak bisa refund (hanya owner)

**Laporan per kasir:**
- [ ] Filter kasir A: hanya transaksi kasir A yang tampil
- [ ] Filter "Semua": semua transaksi (default, sama dengan V1)

---
