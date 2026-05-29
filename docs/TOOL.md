# POS UMKM — Perbandingan V1 → Final
> Satu jalur, tidak ada drop table, tidak ada breaking change.
> V1 adalah fondasi. Final adalah V1 yang diaktifkan penuh.

---

## Prinsip Jalur Ini

Schema V1 **sudah dirancang untuk Final dari hari pertama**. Semua tabel, enum,
dan trigger yang dibutuhkan Final sudah ada di V1 — sebagian aktif, sebagian
sengaja dinonaktifkan di application layer sambil menunggu waktunya.

Tidak ada DROP TABLE. Tidak ada ALTER TABLE yang merusak data.
Migrasi ke Final = aktifkan yang belum aktif + tambah beberapa kolom kecil.

---

## 1. Database — Tabel

| Tabel | V1 | Final | Perubahan |
|---|---|---|---|
| `aktivasi_kode` | ✅ Ada | ✅ Ada | Tidak ada |
| `umkm_config` | ✅ Ada | ✅ Ada | Tidak ada |
| `users` | ✅ Ada | ✅ Ada | Tidak ada kolom baru |
| `kategori` | ✅ Ada | ✅ Ada | Tidak ada |
| `menu_item` | ✅ Ada | ✅ Ada | Tidak ada |
| `diskon_preset` | ✅ Ada | ✅ Ada | Tidak ada |
| `promo_rule` | ✅ Ada di schema, tidak dipakai | ✅ Ada, aktif penuh | Application layer diaktifkan |
| `transaksi` | ✅ Ada | ✅ Ada | Tidak ada |
| `transaction_items` | ✅ Ada | ✅ Ada | Tidak ada |

**Total tabel: 9 → 9. Tidak ada yang ditambah atau dihapus.**

---

## 2. Database — Kolom yang Berubah

Tidak ada kolom yang dihapus. Tidak ada tipe kolom yang berubah.

### `users`
| Kolom | V1 | Final |
|---|---|---|
| `id`, `umkm_id`, `username`, `role`, `is_active`, `created_at`, `updated_at` | ✅ Ada | ✅ Sama |
| `auth_id` | ❌ Tidak ada | ❌ Tidak ada |
| `last_login_at` | ❌ Tidak ada | ❌ Tidak ada |

Tidak ada perubahan pada tabel `users`.

### `transaction_items` — kolom yang naik status
| Kolom | V1 | Final |
|---|---|---|
| `item_type` | Ada, hanya `normal`/`discounted` dipakai | Ada, `promo_free` juga dipakai |
| `triggered_by_item_id` | Ada, selalu NULL | Ada, diisi untuk item BOGO |

Kolomnya sudah ada sejak V1. Di Final, application layer mulai mengisinya.

### `transaksi` — kolom yang naik status
| Kolom | V1 | Final |
|---|---|---|
| `payment_method` | Ada, hanya `cash`/`qris` dipakai | Ada, `transfer`/`debit` juga dipakai |
| `status` | Ada, hanya `completed`/`void` dipakai | Ada, `refund` juga dipakai |

---

## 3. Database — ENUM

Semua ENUM sudah lengkap sejak V1. Final hanya mengaktifkan nilai yang belum dipakai.

| ENUM | V1 (nilai aktif) | Final (nilai aktif) |
|---|---|---|
| `item_type_enum` | `normal`, `discounted` | `normal`, `discounted`, **`promo_free`** |
| `transaksi_status_enum` | `completed`, `void` | `completed`, `void`, **`refund`** |
| `payment_method_enum` | `cash`, `qris` | `cash`, `qris`, **`transfer`**, **`debit`** |
| `tipe_promo_enum` | — tidak dipakai — | `bogo`, `buy2get1` |
| `role_enum` | `owner` | `owner` |

---

## 4. Database — Triggers & Functions

| Objek | V1 | Final |
|---|---|---|
| `trg_validate_grand_total` | ✅ Aktif setiap transaksi | ✅ Sama, tidak berubah |
| `trg_validate_triggered_by_same_transaction` | ✅ Ada, tidak pernah terpicu (triggered_by selalu NULL) | ✅ Aktif, terpicu saat INSERT item BOGO |
| `check_grand_total()` | ✅ Ada | ✅ Sama |
| `check_triggered_by_same_transaction()` | ✅ Ada | ✅ Sama |
| `generate_nomor_order()` | ✅ Ada | ✅ Sama |

**Tidak ada function atau trigger baru di Final. Yang ada di V1 sudah cukup.**

---

## 5. Database — Indexes

| Index | V1 | Final |
|---|---|---|
| `idx_transaksi_umkm_status_created` | ✅ | ✅ |
| `idx_transaksi_kasir` | ✅ | ✅ |
| `idx_transaksi_nomor_order` | ✅ | ✅ |
| `idx_transaction_items_transaksi` | ✅ | ✅ |
| `idx_transaction_items_menu` | ✅ | ✅ |
| `idx_transaction_items_item_type` | ✅ | ✅ |
| `idx_menu_item_umkm_active` | ✅ | ✅ |
| `idx_kategori_umkm` | ✅ | ✅ |
| `idx_diskon_preset_umkm_active` | ✅ | ✅ |
| `idx_promo_rule_menu_active` | ✅ | ✅ |
| `idx_users_umkm_active` | ✅ | ✅ |
| `idx_promo_rule_umkm` | ❌ | ✅ tambah |
| **Total** | **11** | **12** |

Satu index tambahan di Final: `idx_promo_rule_umkm` untuk lookup promo per UMKM.
Ini additive — tidak mengubah apapun yang sudah ada.

---

## 6. Database — RLS

| Aspek | V1 | Final |
|---|---|---|
| RLS | OFF | OFF |
| Isolasi tenant | `.eq('umkm_id', ...)` di setiap query | `.eq('umkm_id', ...)` di setiap query |

Sama persis. Tidak ada perubahan.

---

## 7. Fitur Produk

| Fitur | V1 | Final |
|---|---|---|
| Manajemen menu (tambah, edit, soft delete) | ✅ | ✅ |
| Toggle ketersediaan harian | ✅ | ✅ |
| Kategori menu | ✅ | ✅ |
| Diskon dari preset (tidak ada input bebas) | ✅ | ✅ |
| Payment: Cash + kembalian | ✅ | ✅ |
| Payment: QRIS | ✅ | ✅ |
| Payment: Transfer Bank | ❌ | ✅ |
| Payment: Kartu Debit | ❌ | ✅ |
| Void transaksi | ✅ | ✅ |
| Refund transaksi | ❌ | ✅ |
| Promo BOGO otomatis | ❌ | ✅ |
| Promo Buy2Get1 otomatis | ❌ | ✅ |
| Dashboard omzet hari ini / minggu / bulan | ✅ | ✅ |
| Card refund di dashboard | ❌ | ✅ |
| Export Excel + backup | ✅ | ✅ |
| Import restore | ✅ | ✅ |
| Cetak struk thermal | ✅ | ✅ |
| Aktivasi via kode | ✅ | ✅ |

---

## 8. Application Layer — File yang Berubah

### File yang ditambah di Final (tidak ada di V1)

```
src/lib/db/promo-rule.ts          ← CRUD promo rule (BOGO engine)
src/lib/cart/promo-engine.ts      ← Pure function kalkulasi BOGO
src/app/pengaturan/promo/page.tsx ← UI kelola promo BOGO
src/components/pengaturan/form-promo-rule.tsx
```

### File yang diupdate di Final

| File | V1 | Final — yang berubah |
|---|---|---|
| `src/app/api/aktivasi/route.ts` | Seed `umkm_config` saja, tidak seed `users` | + Seed `users` (owner row) + seed `diskon_preset` default + set cookie `owner_id` |
| `src/lib/utils/umkm-id.ts` | `getUmkmId()` + `clearUmkmId()` | + `getOwnerId()` + `setOwnerId()` |
| `src/lib/db/users.ts` | Tidak ada | + `getCurrentUser()` via cookie `owner_id` |
| `src/lib/db/menu.ts` | Schema lama: `tersedia`, hard delete, tanpa `updated_by` | Schema final: `is_active`, `is_available`, soft delete, `updated_by` |
| `src/lib/db/transaksi.ts` | Schema lama: `timestamp`, `metode_bayar`, tanpa `status`, `kasir_id` | Schema final: `created_at`, `payment_method`, `status`, `kasir_id` + BOGO support |
| `src/lib/db/diskon-preset.ts` | Tidak ada | + CRUD preset diskon dari DB |
| `src/lib/export/excel.ts` | BACKUP_HEADERS schema lama | BACKUP_HEADERS schema final |
| `src/lib/export/import.ts` | Schema lama | Schema final |
| `src/app/kasir/page.tsx` | Tanpa diskon preset, tanpa payment method, tanpa promo | + Load preset + 4 payment method + promo engine |
| `src/app/riwayat/page.tsx` | Hard delete, tanpa status badge, field lama | Void + refund, status badge, field baru |
| `src/app/dashboard/page.tsx` | Field lama (`timestamp`) | Field baru (`created_at`) + card refund |
| `src/app/pengaturan/page.tsx` | `clearUmkmId()` logout | + Link preset diskon + link promo |
| `src/app/pengaturan/diskon/page.tsx` | Tidak ada | + Halaman kelola preset diskon |
| `src/components/kasir/diskon-input.tsx` | Hardcoded preset, ada input bebas | Load dari DB, tidak ada input bebas |
| `src/components/kasir/keranjang-panel.tsx` | Tanpa payment method, tanpa kembalian | + 4 payment method + cash flow + tampilan BOGO |
| `src/components/kasir/struk-print.tsx` | Field lama: `timestamp`, `metode_bayar` | Field baru: `created_at`, `payment_method` + label BOGO |
| `src/components/menu/menu-item-card.tsx` | Field `tersedia` | Field `is_available` |
| `src/components/menu/form-menu-item.tsx` | Field `tersedia` | Field `is_available` |

### File yang tidak berubah sama sekali

```
src/app/aktivasi/page.tsx
src/app/menu/page.tsx            ← logika sama, hanya lib/db/menu.ts yang update
src/app/page.tsx
src/app/globals.css
src/app/layout.tsx
src/lib/supabase/client.ts       ← sudah benar di V1
src/lib/supabase/server.ts       ← sudah benar di V1
src/proxy.ts                     ← sudah benar di V1
src/lib/utils/currency.ts
src/lib/utils/date.ts
src/lib/utils.ts
src/components/kasir/menu-grid.tsx
src/components/menu/kategori-list.tsx
src/components/shared/alert-backup.tsx
src/components/shared/bottom-nav.tsx
src/components/shared/empty-state.tsx
src/components/dashboard/chart-omzet.tsx
src/components/dashboard/stat-card.tsx
src/components/dashboard/top-diskon.tsx
```

---

## 9. Penyebab Utama V1 → Final Butuh Update

Selain fitur baru (BOGO, payment baru, refund), ada **3 gap struktural** di V1
yang wajib difix saat migrasi ke Final:

### Gap 1 — `api/aktivasi` tidak seed `users`

V1 hanya seed `umkm_config`. Akibatnya `menu_item.updated_by`, `diskon_preset.updated_by`,
dan `transaksi.kasir_id` tidak punya UUID yang valid untuk FK. Semua operasi CRUD
menu dan transaksi akan error FK violation.

**Fix di Final:** `api/aktivasi` seed satu row `users` (role = owner), simpan UUID-nya
ke cookie `owner_id`.

### Gap 2 — `lib/db/menu.ts` pakai schema lama

V1 masih pakai kolom `tersedia` (bukan `is_available`), tidak ada `is_active`,
`updated_by`, dan `hapusMenuItem` masih hard delete. Schema final tidak punya
kolom `tersedia` — query akan gagal silent atau return data kosong.

**Fix di Final:** Rewrite `menu.ts` sesuai schema final.

### Gap 3 — `lib/db/transaksi.ts` pakai schema lama

Interface `Transaksi` masih pakai `timestamp`, `metode_bayar`, `subtotal`, `catatan` —
kolom-kolom ini tidak ada di schema final. Setiap query transaksi akan return
data yang tidak bisa di-map ke interface.

**Fix di Final:** Rewrite `transaksi.ts` sesuai schema final.

---

## 10. Known Limitations (sama di V1 dan Final)

| KL | Keterangan | Status |
|---|---|---|
| KL-01 | Overlap periode promo aktif tidak dicegah DB — cek di application layer | Ada di keduanya |
| KL-02 | `is_available` tidak auto-reset harian — toggle manual | Ada di keduanya |
| KL-03 | `generate_nomor_order` SELECT MAX+1 — aman karena single owner | Ada di keduanya |
| KL-04 | RLS disabled — isolasi via `.eq('umkm_id', ...)` wajib di setiap query | Ada di keduanya |
| KL-05 | `triggered_by_item_id` dijaga trigger bukan FK constraint | V1: tidak relevan (selalu NULL). Final: berlaku |

---

## 11. Ringkasan Delta

```
Yang DITAMBAH di Final (tidak ada di V1):
  + promo_rule aktif (BOGO + Buy2Get1)
  + item_type promo_free
  + triggered_by_item_id aktif
  + payment_method: transfer, debit
  + status: refund
  + Seed users saat aktivasi
  + Cookie owner_id
  + getCurrentUser() via cookie
  + Preset diskon dari DB (bukan hardcoded)
  + 1 index baru (idx_promo_rule_umkm)
  + 4 file baru (promo-rule.ts, promo-engine.ts, halaman promo, form-promo-rule)

Yang TIDAK BERUBAH dari V1 ke Final:
  = 9 tabel (struktur identik)
  = 2 triggers (kode identik)
  = 3 functions (kode identik)
  = RLS tetap OFF
  = Tidak ada Supabase Auth
  = Identitas via cookie
  = Tidak ada login screen
  = Single owner
  = 11 indexes lama tetap ada

Yang TIDAK ADA di V1 maupun Final:
  ✗ Multi-user / role kasir
  ✗ Login screen
  ✗ Supabase Auth / JWT
  ✗ RLS policies
  ✗ Filter dashboard per kasir
  ✗ Hard delete (semua operasi hapus = soft delete)
```