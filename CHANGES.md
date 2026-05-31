# POS UMKM — Perubahan v2

## Bug Fixes

### 1. FIX: Schema constraint `transaksi_check`
- **File:** `src/lib/db/transaksi.ts`
- **Problem:** INSERT transaksi gagal karena kolom `diskon_persen` NOT NULL tidak disertakan
- **Fix:** Tambah `diskon_persen: diskonHeaderPersen ?? 0` ke INSERT header transaksi
- **Juga:** Tambah `diskon_persen: number` ke interface `Transaksi`

## UI/UX Changes

### 2. Hapus tombol Trash dari cart-line
- **File:** `src/components/kasir/cart-line.tsx`
- User cukup kurangi qty ke 0 untuk hapus item
- Prop `onHapus` dihapus dari CartLine dan CartPanel

### 3. Tombol keranjang — bar persegi panjang rounded
- **File:** `src/components/kasir/kasir-view.tsx`
- Style: `fixed bottom-[68px] left-4 right-4 rounded-xl` — accessible bar penuh
- Tampilkan jumlah item + grand total
- Desktop: auto-right positioned

### 4. Diskon picker — Drawer (bukan ToggleGroup inline)
- **File:** `src/components/kasir/discount-picker.tsx`
- Chip trigger → buka Drawer dengan list preset
- Lebih clean, tidak overflow

### 5. Kategori di FormMenuItem — sub-drawer di dalam form
- **File:** `src/components/menu/form-menu-item.tsx`
- Kategori selector dipindah ke dalam body form
- Tap tombol Kategori → sub-Drawer pilih kategori
- Tidak ada CategoryBadge di header lagi

### 6. Hapus tombol Kategori dari header menu-view
- **File:** `src/components/menu/menu-view.tsx`
- Tombol "Kategori" di pojok kanan atas dihapus
- Drawer kelola kategori masih tersedia tapi tidak di-expose dari header

### 7. Halaman Diskon — hide jika kosong
- **File:** `src/components/pengaturan/diskon-view.tsx`
- Jika semua preset dihapus: tampilkan empty state saja
- Tidak ada list kosong yang ditampilkan

### 8. Ganti semua emoji → Lucide icons
- Files: kasir-view, riwayat-view, dashboard-view, promo-view, diskon-view, alert-backup, pengaturan-view, aktivasi-view
- Tidak ada emoji di mana pun

## Schema Fix (Supabase)

Jika kolom `diskon_persen` belum ada di tabel `transaksi`, jalankan:
```sql
ALTER TABLE transaksi 
ADD COLUMN IF NOT EXISTS diskon_persen numeric NOT NULL DEFAULT 0;
```

---

## v3 — Final

### Bug Fix: PGRST204 diskon_persen column not found
- **File:** `src/lib/db/transaksi.ts`
- Kolom `diskon_persen` tidak ada di tabel `transaksi` (hanya di `transaction_items`)
- Fix: Hapus `diskon_persen` dari INSERT header transaksi
- Fix: V1 cash mode → auto-set `uang_diterima = grand_total`, `kembalian = 0`
  (schema check mensyaratkan cash wajib punya nilai ini)

### UI: Hapus pensil icon dari menu row
- **File:** `src/components/menu/menu-item-card.tsx`
- Tap baris = buka edit — pensil redundan, dihapus
- Switch tetap untuk toggle ketersediaan

### UI: FAB Tambah menu — posisi tengah bawah (Instagram style)
- **File:** `src/components/menu/menu-view.tsx`
- `left-1/2 -translate-x-1/2` → centered
- Selalu tampil (bukan hanya saat ada item)

### UI: Tinggi drawer Pilih Kategori = tinggi Tambah Menu
- **File:** `src/components/menu/form-menu-item.tsx`, `menu-view.tsx`
- Sub-drawer kategori: `max-h-[88dvh]` (sama dengan FormDrawer)
- Drawer Kelola Kategori: `max-h-[88dvh]` (sama)

### Schema Final: schema.sql
- File baru: `schema.sql` — schema lengkap siap run di Supabase
- Tabel transaksi TIDAK punya kolom diskon_persen
- Semua check constraint sudah benar
