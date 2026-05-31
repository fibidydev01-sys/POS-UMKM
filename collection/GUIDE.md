# POS UMKM MVP — Audit & Panduan Refactor UI/UX

> **Scope dokumen ini**: hasil audit menyeluruh + rencana eksekusi untuk **rewrite total layout UI/UX** memakai **shadcn/ui**, dengan **mempertahankan tema warna "Warung Modern"** (terracotta + teal di atas krem). Fokus utama: **memperbaiki tampilan Kasir yang rusak di mobile/tablet** (item grid, item list, toggle) dan **merampingkan page components** dengan memindahkan logika ke `components/`, `hooks/`, `store/`, dan `lib/`.
>
> **Prinsip non-negotiable**:
> 1. **Mobile-portrait FIRST**, lalu tablet, lalu desktop. Bukan sebaliknya.
> 2. **Warna & token visual tetap** (lihat §6). Yang berubah adalah *struktur komponen*, *layout primitives*, dan *behavior responsif*.
> 3. **Tidak menyentuh skema database, RPC, atau kontrak Supabase.** Refactor ini murni front-end + arsitektur kode.
> 4. **Feature flag V1/V2 tetap utuh.** Semua perbaikan harus tetap menghormati `features.*`.

---

## 1. Ringkasan Eksekutif

Aplikasi ini secara fungsional sudah lengkap dan rapi di sisi *data layer* (query Supabase, promo engine, util tanggal/currency semua bersih dan teruji). **Masalahnya murni di lapisan presentasi**: layout responsif dibangun dengan banyak *magic number* dan *hand-rolled component*, bukan dengan sistem komponen yang konsisten.

Tiga kategori masalah:

| # | Kategori | Dampak | Prioritas |
|---|----------|--------|-----------|
| A | **Responsif rusak** (Kasir grid/list, cart panel, floating button) | Tampilan pecah di mobile & tablet — *blocker* | 🔴 P0 |
| B | **Komponen hand-rolled** (toggle switch ×3, chip, dialog flow) | Inkonsistensi visual + bug a11y | 🔴 P0 |
| C | **Page components gemuk** (logika + fetch + JSX tercampur) | Sulit dirawat, banyak duplikasi | 🟠 P1 |

Strategi: adopsi shadcn/ui sebagai *single source of truth* untuk primitives, ganti semua layout fixed-positioning dengan komponen `Sidebar`/`Sheet`/`Drawer` resmi, dan ekstrak logika page ke hooks + Zustand store.

---

## 2. Inventaris File (apa yang ada sekarang)

Total **46 file** sumber. Pengelompokan untuk konteks refactor:

### 2.1 App routes (`src/app/`) — **GEMUK, perlu dirampingkan**
| File | Baris | Tanggung jawab saat ini | Status |
|------|-------|--------------------------|--------|
| `layout.tsx` | 30 | Root layout + font + AppShell | ✅ OK |
| `page.tsx` | 10 | Redirect berdasarkan cookie | ✅ OK |
| `aktivasi/page.tsx` | 151 | 2-step wizard aktivasi + form profil | 🟠 sedang |
| `dashboard/page.tsx` | 134 | Fetch 5 sumber + render statistik | 🟠 fetch di page |
| **`kasir/page.tsx`** | **245** | **State cart + fetch + promo + bayar + dialog** | 🔴 **sangat gemuk** |
| `menu/page.tsx` | 210 | CRUD menu + kategori + 2 dialog | 🔴 gemuk |
| `pengaturan/page.tsx` | 227 | Profil + kertas + export/import + nav | 🔴 gemuk |
| `pengaturan/diskon/page.tsx` | 188 | CRUD preset diskon | 🟠 sedang |
| `pengaturan/promo/page.tsx` | 186 | CRUD promo rule | 🟠 sedang |
| **`riwayat/page.tsx`** | **254** | **List + detail dialog + void + refund** | 🔴 **sangat gemuk** |

### 2.2 Komponen (`src/components/`)
| File | Baris | Catatan audit |
|------|-------|---------------|
| `dashboard/chart-omzet.tsx` | 146 | Chart manual pakai div+Tailwind. Bisa diganti shadcn **Chart** (recharts) |
| `dashboard/stat-card.tsx` | 36 | Bisa pakai shadcn **Card** |
| `dashboard/top-diskon.tsx` | 77 | Pakai shadcn **Card** + progress bar |
| **`kasir/keranjang-panel.tsx`** | **392** | 🔴 **file terbesar & paling bermasalah** — dua renderer (Drawer+Sheet), hook deteksi tablet SSR-unsafe |
| `kasir/menu-grid.tsx` | 41 | 🔴 grid breakpoint sembarang + `aspect-square`/`line-clamp` bentrok |
| `kasir/diskon-input.tsx` | 73 | Chip hand-rolled → shadcn **ToggleGroup** |
| `kasir/struk-print.tsx` | 148 | ✅ logika print OK, sentuh seperlunya |
| `menu/form-menu-item.tsx` | 186 | 🔴 toggle hand-rolled + dialog manual |
| `menu/kategori-list.tsx` | 45 | Chip → shadcn **ToggleGroup**/**Tabs** |
| `menu/menu-item-card.tsx` | 64 | 🔴 toggle hand-rolled (`role="switch"`) |
| `pengaturan/form-diskon-preset.tsx` | 122 | Form dialog manual → shadcn **Field** |
| `pengaturan/form-promo-rule.tsx` | 162 | `<select>` native + radio hand-rolled |
| `shared/alert-backup.tsx` | 38 | → shadcn **Alert** |
| `shared/app-shell.tsx` | 195 | 🔴 sidebar + bottom-nav fixed manual → shadcn **Sidebar** |
| `shared/empty-state.tsx` | 22 | → shadcn **Empty** |

### 2.3 Lib (`src/lib/`) — **SEHAT, jangan diutak-atik logikanya**
| Area | File | Status |
|------|------|--------|
| `cart/` | `promo-engine.ts` (126) | ✅ pure function, teruji — **pertahankan** |
| `db/` | `config`, `diskon-preset`, `menu`, `omzet-banding`, `promo-rule`, `transaksi` (469), `users` | ✅ data layer bersih |
| `export/` | `excel.ts` (185), `import.ts` (186) | ✅ pertahankan |
| `supabase/` | `client.ts`, `server.ts` | ✅ |
| `utils/` | `currency`, `date` (87), `paper`, `umkm-id` | ✅ |
| `config/` | `features.ts` (57) | ✅ **jantung V1/V2** — pertahankan |
| root | `utils.ts` (cn) | ✅ |

> **Kesimpulan inventaris**: lapisan `lib/` tidak perlu diubah secara logika. Semua pekerjaan ada di `app/` (rampingkan) dan `components/` (rewrite dengan shadcn).

---

## 3. Temuan Bug — Detail Teknis

Setiap temuan di bawah sudah ditelusuri langsung dari kode. Disusun dari paling parah.

### 🔴 BUG-01 — Cart panel: hook deteksi tablet tidak SSR-safe → flash + remount
**File**: `src/components/kasir/keranjang-panel.tsx`

```ts
function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = React.useState(false); // ← selalu mulai false
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsTablet(mq.matches); // ← baru benar SETELAH mount
    ...
  }, []);
  return isTablet;
}
```

**Masalah**:
- Default `false` artinya **di tablet, render pertama selalu versi mobile (Drawer)**, lalu setelah hydration berganti ke `Sheet`. Ini menyebabkan **flash** dan **unmount→remount** seluruh isi panel.
- Karena `KeranjangPanel` memilih `<KeranjangSheet>` vs `<KeranjangDrawer>` berdasarkan boolean ini, **dua pohon komponen berbeda** dipasang. Saat swap, **state focus input "uang diterima" dan posisi scroll hilang**.
- Konsekuensi terburuk: jika kasir membuka keranjang sangat cepat saat load di tablet, ia melihat drawer mobile yang "salah tempat".

**Akar masalah arsitektural**: memilih *komponen* berbeda berdasarkan viewport, alih-alih satu komponen yang *layout-nya* adaptif.

---

### 🔴 BUG-02 — Dua renderer panel duplikat + selektor close-button rapuh
**File**: `src/components/kasir/keranjang-panel.tsx`

```tsx
// Sheet tablet menyembunyikan tombol close bawaan via selektor posisi:
"[&>button:first-child]:hidden"
```

**Masalah**:
- `KeranjangSheet` dan `KeranjangDrawer` membungkus `PanelContent` yang sama → **392 baris** untuk satu fitur, dua jalur kode untuk dirawat.
- Trik `[&>button:first-child]:hidden` mengasumsikan shadcn selalu me-render `SheetClose` sebagai anak pertama. **Begitu versi shadcn mengubah urutan DOM, tombol close muncul/hilang tak terduga.**
- Komentar di kode sendiri mengakui kerapuhan ini ("shadcn SheetContent selalu render SheetClose sebagai first-child") — asumsi yang tidak dijamin.

---

### 🔴 BUG-03 — Floating cart button: posisi pakai magic number mirror sidebar
**File**: `src/app/kasir/page.tsx`

```tsx
<div className="fixed inset-x-0 bottom-[58px] z-30 px-4 print:hidden
                md:bottom-4 md:left-[72px] xl:left-[200px]">
```

**Masalah**:
- `bottom-[58px]` = tinggi bottom-nav (hardcoded). `left-[72px]` / `xl:left-[200px]` = lebar sidebar (hardcoded, harus sinkron manual dengan `app-shell.tsx`).
- `globals.css` punya komentar panjang yang menjelaskan kenapa ini rapuh — itu **bukti** bahwa solusinya salah, bukan dokumentasi yang menenangkan.
- Tiga sumber kebenaran lebar/tinggi nav (`globals.css` var, `app-shell.tsx` class, `kasir/page.tsx` offset) yang **harus diubah bersamaan** atau layout pecah.

---

### 🔴 BUG-04 — Menu grid: `aspect-square` × `line-clamp-3` × breakpoint sembarang
**File**: `src/components/kasir/menu-grid.tsx`

```tsx
<div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 min-[700px]:grid-cols-4">
  ...
  <button className="relative flex aspect-square flex-col justify-between ...">
    <span className="line-clamp-3 text-sm font-semibold leading-snug">{item.nama}</span>
    <span className="text-sm font-bold text-primary">{formatRupiah(item.harga)}</span>
  </button>
```

**Masalah**:
- **`aspect-square` memaksa tinggi = lebar.** Di mobile 2 kolom, kartu jadi besar; di tablet 4 kolom, kartu jadi kecil — **nama 3 baris + harga sering tidak muat**, teks ke-clip atau menabrak harga.
- Breakpoint `min-[480px]` dan `min-[700px]` adalah **pixel arbitrer** yang tidak selaras dengan breakpoint Tailwind/shadcn (`sm 640 / md 768 / lg 1024`). Akibatnya transisi kolom terjadi di titik yang tidak konsisten dengan komponen lain (mis. sidebar muncul di `md=768` tapi grid sudah 4 kolom sejak `700`).
- Badge qty `absolute right-2 top-2` di atas kartu square kecil → menutupi nama produk di tablet.
- `active:scale-[0.97]` pada kartu square + ring `ring-2` membuat layout shift kecil saat ditekan di mobile.

**Inilah inti keluhan "item grid buggy banget".**

---

### 🔴 BUG-05 — Toggle switch hand-rolled di 3 tempat, tidak konsisten & a11y pincang
**File**: `menu-item-card.tsx`, `form-menu-item.tsx`, (+ pola chip di `diskon-input.tsx`)

```tsx
// menu-item-card.tsx — PUNYA role/aria:
<button role="switch" aria-checked={item.is_available} ...>
  <span className={cn("absolute top-0.5 h-5 w-5 ...", item.is_available ? "translate-x-[22px]" : "translate-x-0.5")} />
</button>

// form-menu-item.tsx — TIDAK punya role/aria:
<button type="button" onClick={() => setIsAvailable(v => !v)} ...>
  <span className={cn("...", isAvailable ? "translate-x-[22px]" : "translate-x-0.5")} />
</button>
```

**Masalah**:
- **Dua implementasi switch berbeda** untuk konsep yang sama (ketersediaan menu). Satu punya `role="switch"`+`aria-checked`, satu tidak → **screen reader & keyboard tidak konsisten**.
- `translate-x-[22px]` adalah magic number yang bergantung pada ukuran track/thumb spesifik. Begitu padding berubah, knob meleset dari track.
- Tidak ada state `:focus-visible`, tidak ada `disabled` saat request optimistic berjalan → user bisa spam-toggle dan memicu race.
- **Inilah "toggle button broken"** yang dimaksud user: bukan cuma gaya, tapi behavior & aksesibilitas.

---

### 🟠 BUG-06 — `alert()` & `window.confirm()` di mana-mana
**File**: `kasir/page.tsx` (bayar gagal/uang kurang), `riwayat/page.tsx` (void/refund), `menu/page.tsx` (hapus), `pengaturan/page.tsx` (import destruktif), semua form.

**Masalah**: dialog blocking native **memblokir thread JS**, tampil di luar tema (kotak abu-abu OS), tidak bisa di-style, dan di mobile sering tampil di posisi canggung. Tidak ada feedback sukses yang halus (toast).

---

### 🟠 BUG-07 — Loading state berupa string telanjang
Setiap page:
```tsx
if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat…</div>;
```
**Masalah**: tidak ada skeleton; layar berkedip dari "Memuat…" ke konten penuh. Tidak profesional & terasa lambat (tidak ada perceived performance).

---

### 🟠 BUG-08 — Dua jalur identitas user (async vs sync cookie)
- `dashboard`, `kasir`, `riwayat` → `await getCurrentUser()` (query DB by `owner_id`).
- `menu`, `pengaturan`, `pengaturan/diskon`, `pengaturan/promo` → `getUmkmId()` + `getOwnerId()` (baca cookie sync).

**Masalah**: dua sumber kebenaran identitas, dua pola loading, logika redirect `/aktivasi` diduplikasi 7×. Rentan *drift*.

---

### 🟠 BUG-09 — Fetch & business logic menempel di page
- `kasir/page.tsx`: 11 `useState`, `Promise.all` 5 sumber, kalkulasi promo, handler bayar — semua di komponen.
- `riwayat/page.tsx`: list + detail + void + refund + tanggal grouping — semua di komponen.
- Tidak ada caching: pindah Kasir → Menu → Kasir = fetch ulang penuh.

---

### 🟡 BUG-10 — Inkonsistensi kecil lain
- `chart-omzet.tsx`: warna hardcoded hex (`#1c140e`, `#d2c5b8`, `#9a8e82`) di luar token tema → tidak ikut kalau tema disesuaikan.
- `kategori-list.tsx` & `diskon-input.tsx`: dua gaya "chip" berbeda untuk pola pilihan yang sama.
- `form-promo-rule.tsx`: pakai `<select>` & `<input type="date">` native (tidak match shadcn), radio hand-rolled.
- Scrollbar & focus ring tidak seragam antar komponen.

---

## 4. Strategi Solusi — Pemetaan ke shadcn/ui

Prinsip: **satu pola = satu komponen shadcn.** Tabel ini adalah kontrak penggantian.

| Masalah lama | Komponen shadcn pengganti | Catatan implementasi |
|--------------|---------------------------|----------------------|
| `app-shell.tsx` sidebar + bottom-nav fixed (BUG-03) | **`Sidebar`** (`sidebar-07`/icon-collapsible) + **`Sheet`** untuk mobile | Sidebar resmi menangani collapse icon↔label & offset konten otomatis. **Hapus semua `left-[72px]`/`ml-[200px]`/`bottom-[58px]`.** |
| Cart panel Drawer+Sheet ganda (BUG-01/02) | **`Drawer`** (vaul, sudah dipakai) untuk SEMUA ukuran, atau **`Sheet side="right"`** di ≥`md` | Pilih **satu** komponen; layout di dalamnya yang adaptif via `ScrollArea`. Buang `useIsTablet`. |
| Toggle switch hand-rolled (BUG-05) | **`Switch`** | Satu komponen, a11y bawaan, ada `disabled`. Ganti di `menu-item-card`, `form-menu-item`. |
| Chip pilihan diskon/kategori (BUG-10) | **`ToggleGroup`** (single) atau **`Tabs`** | `ToggleGroup type="single"` untuk diskon & filter kategori. |
| Menu grid square (BUG-04) | **`Card`** + grid responsif token-based + **`ScrollArea`** | Buang `aspect-square`; pakai tinggi konten + `min-h`. Breakpoint pakai `sm/md/lg`. Badge qty via **`Badge`**. |
| `alert()`/`confirm()` (BUG-06) | **`Sonner`** (toast) + **`AlertDialog`** | Sukses → toast; konfirmasi destruktif (void/refund/hapus/import) → AlertDialog. |
| Loading string (BUG-07) | **`Skeleton`** + **`Spinner`** | Skeleton per-section (kartu statistik, grid, list). |
| Empty state custom | **`Empty`** | Ganti `empty-state.tsx`. |
| Alert backup | **`Alert`** (variant warning) | |
| Form fields manual | **`Field`** + **`Input`**/**`Textarea`**/**`Label`** | Konsistensi spacing & error. |
| `<select>` native promo | **`Select`** | |
| `<input type="date">` | **`Calendar`** + **`Popover`** (Date Picker) atau **`Input` type=date** distyle | |
| Chart omzet manual (BUG-10) | **`Chart`** (recharts) | Bar chart minggu-ini vs minggu-lalu pakai token tema, bukan hex. |
| Dialog flow manual | **`Dialog`** / **`Sheet`** konsisten | Detail transaksi & struk. |
| Tombol payment method | **`ToggleGroup`** atau **`RadioGroup` Card** | |

### 4.1 Catatan khusus layout responsif (mobile-portrait first)

**Aturan main breakpoint** (selaraskan SEMUA komponen):
- **Default (0–639px) = mobile portrait** → bottom navigation (Sheet/inline), grid **2 kolom**, cart = Drawer full-width.
- **`sm` (≥640)** → grid **3 kolom**.
- **`md` (≥768)** → muncul **Sidebar** (icon-only), grid **3–4 kolom**, cart bisa pindah ke Sheet kanan.
- **`lg` (≥1024)** → Sidebar **expanded** (icon+label).

> **Penting**: jangan lagi memakai `min-[480px]`/`min-[700px]`. Itu sumber inkonsistensi antara grid dan sidebar.

**Floating cart button** → letakkan **di dalam** area konten (`<main>` yang sudah ter-offset Sidebar), `position: sticky bottom-0` atau fixed yang anchor ke container konten, **bukan** ke viewport dengan offset manual. Dengan shadcn `Sidebar`, `<SidebarInset>` sudah menangani offset, jadi tombol cukup `sticky bottom-4` di dalamnya.

---

## 5. Arsitektur Target — Rampingkan Page

Tujuan: **page = orkestrasi tipis.** Fetch → hook. State global ringan → store. Render → komponen. Logika murni → lib.

### 5.1 Struktur folder baru

```
src/
├─ app/
│  ├─ kasir/page.tsx            # < 40 baris: render <KasirView/>
│  ├─ riwayat/page.tsx          # < 40 baris
│  ├─ menu/page.tsx             # < 40 baris
│  └─ ...                       # idem untuk semua route
│
├─ components/
│  ├─ ui/                       # shadcn (generated) — JANGAN edit manual berlebihan
│  ├─ kasir/
│  │  ├─ kasir-view.tsx         # komposisi halaman kasir
│  │  ├─ menu-grid.tsx          # rewrite (Card + grid token)
│  │  ├─ menu-card.tsx          # 1 kartu produk
│  │  ├─ cart-panel.tsx         # SATU panel adaptif (Drawer/Sheet)
│  │  ├─ cart-line.tsx          # 1 baris item keranjang
│  │  ├─ cart-summary.tsx       # subtotal/diskon/total + tombol bayar
│  │  ├─ payment-method.tsx     # ToggleGroup metode bayar
│  │  └─ discount-picker.tsx    # ToggleGroup preset diskon
│  ├─ riwayat/
│  │  ├─ riwayat-view.tsx
│  │  ├─ transaksi-row.tsx
│  │  └─ transaksi-detail-sheet.tsx
│  ├─ shared/
│  │  ├─ app-sidebar.tsx        # shadcn Sidebar
│  │  ├─ mobile-nav.tsx         # bottom nav (Sheet/inline)
│  │  ├─ page-skeleton.tsx      # skeleton reusable
│  │  └─ confirm-dialog.tsx     # AlertDialog generik
│  └─ ...
│
├─ hooks/                       # ← BARU
│  ├─ use-current-user.ts       # satu-satunya sumber identitas (gabung getCurrentUser/getUmkmId)
│  ├─ use-kasir-data.ts         # fetch menu+kategori+config+preset+promo
│  ├─ use-dashboard-data.ts
│  ├─ use-riwayat.ts
│  ├─ use-menu-manager.ts       # CRUD menu+kategori
│  └─ use-is-desktop.ts         # matchMedia SSR-safe (default sesuai SSR fallback)
│
├─ store/                       # ← BARU (Zustand)
│  ├─ cart-store.ts             # cartRaw, tambah/ubah/hapus, diskon, payment, reset
│  └─ ui-store.ts               # state UI lintas-komponen (panel open, dll) bila perlu
│
└─ lib/                         # TETAP (logika tidak berubah)
   ├─ cart/promo-engine.ts
   ├─ db/*  export/*  supabase/*  utils/*  config/features.ts
```

### 5.2 Contoh hasil "page tipis"

**Sebelum** — `kasir/page.tsx` (245 baris, semua tercampur).
**Sesudah**:

```tsx
// src/app/kasir/page.tsx  (target < 40 baris)
import { KasirView } from "@/components/kasir/kasir-view";
export default function KasirPage() {
  return <KasirView />;
}
```

```tsx
// src/components/kasir/kasir-view.tsx  (orkestrasi)
"use client";
import { useKasirData } from "@/hooks/use-kasir-data";
import { useCartStore } from "@/store/cart-store";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { MenuGrid } from "./menu-grid";
import { CartPanel } from "./cart-panel";
// ...
export function KasirView() {
  const { data, isLoading } = useKasirData();
  if (isLoading) return <PageSkeleton variant="kasir" />;
  // render grid + floating button + CartPanel; logika bayar ada di hook/store
}
```

```ts
// src/store/cart-store.ts  (Zustand — state cart pindah dari page)
import { create } from "zustand";
import type { CartItem } from "@/lib/db/transaksi";

interface CartState {
  items: CartItem[];
  diskonPresetId: string | null;
  diskonPersen: number;
  paymentMethod: "cash" | "qris" | "transfer" | "debit";
  uangDiterima: string;
  tambah: (item: { id: string; nama: string; harga: number }) => void;
  ubahQty: (id: string | null, delta: number) => void;
  hapus: (id: string | null) => void;
  setDiskon: (id: string | null, persen: number) => void;
  setPayment: (m: CartState["paymentMethod"]) => void;
  reset: () => void;
}
export const useCartStore = create<CartState>((set) => ({ /* ... */ }));
```

> **Manfaat**: `promo-engine` dipanggil dari selector store (memoized), bukan di-`useMemo` page. Handler `bayar()` jadi action store yang memanggil `simpanTransaksi` dari `lib/db`. Page tidak tahu detail apa pun.

### 5.3 Hook identitas tunggal (selesaikan BUG-08)

```ts
// src/hooks/use-current-user.ts
"use client";
// Gabungkan logika getCurrentUser (DB) + getUmkmId/getOwnerId (cookie)
// menjadi SATU hook. Semua page pakai ini → redirect /aktivasi terpusat.
export function useCurrentUser() {
  // return { user, umkmId, ownerId, isLoading }
  // jika tidak ada → router.replace("/aktivasi") di satu tempat
}
```

---

## 6. Token Warna — WAJIB DIPERTAHANKAN

Tema "Warung Modern" **tidak berubah**. shadcn/ui dikonfigurasi memakai CSS variable yang sudah ada di `globals.css`. Saat `npx shadcn init`, petakan ke variable berikut (jangan biarkan shadcn menimpa dengan palet default-nya).

| Token | Light value (saat ini) | Peran |
|-------|------------------------|-------|
| `--background` | `#faf7f2` (krem) | latar utama |
| `--foreground` | `#1c1917` | teks utama |
| `--card` | `#ffffff` | permukaan kartu |
| `--primary` | `#c2410c` (terracotta) | aksi utama, brand |
| `--primary-foreground` | `#ffffff` | teks di atas primary |
| `--secondary` / `--muted` | `#f3eee6` | permukaan sekunder |
| `--accent` | `#0f766e` (teal) | highlight, BOGO, sukses-aksen |
| `--destructive` | `#dc2626` | hapus/void |
| `--success` | `#15803d` | status selesai |
| `--warning` | `#b45309` | refund/peringatan backup |
| `--border` / `--input` | `#e7e0d5` | garis & field |
| `--ring` | `#c2410c` | focus ring |
| `--radius` | `0.75rem` | radius global |

**Aturan**:
1. **Semua komponen shadcn pakai token ini**, bukan hex langsung.
2. **Perbaiki BUG-10**: hex hardcoded di `chart-omzet.tsx` (`#1c140e`, `#d2c5b8`, `#9a8e82`) → ganti jadi token (mis. tooltip pakai `--foreground`/popover, batang "minggu lalu" pakai `--muted-foreground`/`--border`).
3. Font tetap **Plus Jakarta Sans** (`--font-jakarta`).
4. Aturan **print struk** di `globals.css` (`@media print`, `#area-struk`, `58mm/80mm`) **dipertahankan apa adanya** — itu kritikal untuk thermal printer.

---

## 7. Rencana Eksekusi Bertahap

Urutan dirancang agar tiap fase bisa di-*merge* tanpa mematahkan build.

### Fase 0 — Fondasi (½ hari)
- [ ] `npx shadcn@latest init` → **petakan ke token §6** (jangan pakai palet default).
- [ ] Tambah komponen: `button card switch toggle-group tabs sheet drawer sidebar scroll-area skeleton spinner sonner alert-dialog alert badge separator input textarea label select field empty chart`.
- [ ] Pasang **`<Toaster/>`** (Sonner) di `layout.tsx`.
- [ ] Tambah Zustand: `npm i zustand`.
- [ ] Verifikasi tema: render satu Button + Card, pastikan terracotta & radius benar.

### Fase 1 — Shell & navigasi (BUG-03) (1 hari)
- [ ] Ganti `app-shell.tsx` → `app-sidebar.tsx` (shadcn `Sidebar`, icon-collapsible) + `SidebarInset` untuk konten.
- [ ] Mobile: bottom nav memakai komponen sendiri (boleh inline `nav` distyle shadcn, atau `Sheet`).
- [ ] **Hapus semua offset manual** (`ml-[72px]`, `xl:ml-[200px]`, `pb-[58px]`).
- [ ] Update komentar di `globals.css` (hapus penjelasan magic-number lama).

### Fase 2 — Kasir grid & toggle (BUG-04, BUG-05) (1–1.5 hari) 🔴 prioritas user
- [ ] Rewrite `menu-grid.tsx`: `Card` + grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, **buang `aspect-square`**, nama `line-clamp-2`, harga selalu terlihat, badge qty pakai `Badge`. Bungkus area scroll dengan `ScrollArea`.
- [ ] Ganti **semua toggle** ke `Switch` (`menu-item-card.tsx`, `form-menu-item.tsx`) — tambahkan `disabled` saat optimistic update berjalan.
- [ ] Ganti chip diskon & filter kategori ke `ToggleGroup type="single"`.
- [ ] Uji di lebar 360/390/414 (mobile), 768/834 (tablet portrait), 1024+ (desktop).

### Fase 3 — Cart panel tunggal (BUG-01, BUG-02) (1 hari)
- [ ] Buat `cart-panel.tsx` **satu komponen**. Gunakan `Drawer` (vaul) untuk semua, atau `useIsDesktop` SSR-safe untuk memilih `Sheet side="right"` di `md+`. **Tidak ada dua pohon `PanelContent`.**
- [ ] Pecah isi: `cart-line.tsx`, `discount-picker.tsx`, `payment-method.tsx`, `cart-summary.tsx`.
- [ ] Floating button → `sticky bottom-4` di dalam `SidebarInset` (tanpa offset manual).
- [ ] Hubungkan ke `cart-store`.

### Fase 4 — Toast & konfirmasi (BUG-06) (½ hari)
- [ ] Sukses bayar/simpan/hapus → `toast.success`.
- [ ] Error → `toast.error`.
- [ ] Destruktif (void, refund, hapus menu/preset/promo, **import**) → `AlertDialog` via `confirm-dialog.tsx`.
- [ ] Hapus semua `alert()` & `window.confirm()`.

### Fase 5 — Skeleton & state (BUG-07) (½ hari)
- [ ] `page-skeleton.tsx` dengan varian (`dashboard`, `kasir`, `list`, `form`).
- [ ] Ganti semua `"Memuat…"` string.
- [ ] Empty states → komponen `Empty`.

### Fase 6 — Rampingkan page + hooks + store (BUG-08, BUG-09) (1.5–2 hari)
- [ ] Buat `use-current-user`, `use-kasir-data`, `use-dashboard-data`, `use-riwayat`, `use-menu-manager`.
- [ ] Pindahkan fetch & handler dari page ke hooks; state cart ke `cart-store`.
- [ ] Tipiskan semua `app/**/page.tsx` jadi pemanggil `*-view`.
- [ ] Hilangkan duplikasi redirect `/aktivasi`.

### Fase 7 — Polish (BUG-10) (½ hari)
- [ ] Chart omzet → shadcn `Chart`, warna pakai token.
- [ ] Form promo → `Select` + Date Picker shadcn.
- [ ] Audit focus ring, scrollbar, spacing konsisten.
- [ ] Lulus `lint` + `typecheck`.

---

## 8. Daftar Periksa Penerimaan (Acceptance Criteria)

Refactor dianggap **selesai** jika SEMUA terpenuhi:

**Responsif (fokus utama)**
- [ ] Kasir grid rapi di **360px** (2 kol), **640px** (3 kol), **768px+** (3–4 kol) tanpa teks ter-clip atau menabrak harga.
- [ ] Tidak ada `aspect-square` pada kartu produk.
- [ ] Cart panel **tidak flash/remount** saat load di tablet; satu komponen adaptif.
- [ ] Floating cart button tidak pernah tertutup nav dan **tidak** memakai offset magic-number.
- [ ] Tidak ada breakpoint `min-[480px]`/`min-[700px]`; semua pakai `sm/md/lg`.

**Komponen**
- [ ] Semua toggle = shadcn `Switch` dengan `role`/`aria` bawaan + `disabled` saat loading.
- [ ] Semua chip pilihan = `ToggleGroup`/`Tabs`.
- [ ] Tidak ada `alert()`/`window.confirm()`; sukses=toast, destruktif=`AlertDialog`.
- [ ] Semua loading = `Skeleton`; empty = `Empty`.

**Arsitektur**
- [ ] Semua `app/**/page.tsx` < ~40 baris.
- [ ] Fetch ada di `hooks/`; state cart di `store/`; logika murni tetap di `lib/`.
- [ ] Satu hook identitas user; redirect `/aktivasi` tidak terduplikasi.

**Tetap utuh**
- [ ] Token warna §6 tidak berubah (terracotta/teal/krem).
- [ ] `@media print` struk 58/80mm berfungsi sama.
- [ ] Feature flag V1/V2 (`features.*`) tetap mengontrol payment/refund/promo persis seperti sebelumnya.
- [ ] Tidak ada perubahan skema DB / query / RPC.
- [ ] `lint` & `typecheck` PASSED.

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| shadcn `Sidebar` menimpa token tema | Init dengan mapping eksplisit ke variable §6; cek visual sebelum lanjut. |
| Migrasi cart ke store memutus alur promo | `promo-engine` tetap pure; store hanya menyimpan `cartRaw`, promo dihitung di selector — sama seperti `useMemo` lama. |
| Print struk rusak setelah ganti layout | Jangan sentuh `#area-struk` & `@media print`; uji cetak di tiap fase yang menyentuh kasir/riwayat. |
| Feature flag terlewat saat rewrite komponen | Pertahankan pemanggilan `features.*` di komponen baru (payment, refund, promo). Tambahkan checklist per komponen. |
| Drawer vaul + Sheet konflik gesture di tablet | Pilih **satu** mekanisme per breakpoint via `useIsDesktop` SSR-safe; jangan render keduanya. |

---

## 10. Lampiran — Pemetaan File Lama → Baru (ringkas)

| Lama | Aksi | Baru |
|------|------|------|
| `components/shared/app-shell.tsx` | ganti | `shared/app-sidebar.tsx` + `shared/mobile-nav.tsx` |
| `components/kasir/keranjang-panel.tsx` (392) | pecah | `cart-panel` + `cart-line` + `cart-summary` + `payment-method` + `discount-picker` |
| `components/kasir/menu-grid.tsx` | rewrite | `menu-grid` + `menu-card` |
| `components/kasir/diskon-input.tsx` | ganti | `discount-picker` (ToggleGroup) |
| `components/menu/menu-item-card.tsx` | rewrite | idem (Switch) |
| `components/menu/form-menu-item.tsx` | rewrite | idem (Switch + Field) |
| `components/menu/kategori-list.tsx` | ganti | ToggleGroup/Tabs |
| `components/shared/empty-state.tsx` | ganti | shadcn `Empty` |
| `components/shared/alert-backup.tsx` | ganti | shadcn `Alert` |
| `components/dashboard/chart-omzet.tsx` | rewrite | shadcn `Chart` |
| `components/dashboard/stat-card.tsx` | refit | shadcn `Card` |
| `app/kasir/page.tsx` (245) | rampingkan | `app/kasir/page.tsx` + `kasir-view` + `use-kasir-data` + `cart-store` |
| `app/riwayat/page.tsx` (254) | rampingkan | `app/riwayat/page.tsx` + `riwayat-view` + `use-riwayat` |
| `app/menu/page.tsx` (210) | rampingkan | `menu-view` + `use-menu-manager` |
| `app/pengaturan/*` | rampingkan | `*-view` + hooks |
| `lib/**` | **tidak diubah** | — |

---

*Dokumen ini adalah panduan refactor, bukan implementasi. Eksekusi mengikuti Fase 0→7 dengan acceptance criteria §8 sebagai gerbang penerimaan.*