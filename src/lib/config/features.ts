/**
 * Feature flags — satu ENV var mengontrol V1 vs Final experience.
 *
 * .env.local / hosting env:
 *   NEXT_PUBLIC_POS_VERSION=v1     → V1 (default, aman untuk early launch)
 *   NEXT_PUBLIC_POS_VERSION=final  → Final (semua fitur aktif)
 *
 * NEXT_PUBLIC_ karena dikonsumsi client component secara synchronous.
 * Bukan rahasia — hanya toggle UX, bukan kredensial.
 *
 * Flip procedure:
 *   1. Ubah NEXT_PUBLIC_POS_VERSION=final di .env.local / hosting env
 *   2. Redeploy
 *   3. Done — semua user langsung dapat Final experience
 */

const VERSION = (process.env.NEXT_PUBLIC_POS_VERSION ?? "v1").trim().toLowerCase();
const isFinal = VERSION === "final";

export const features = {
  /**
   * Transfer bank + kartu debit di kasir.
   * V1: hanya Cash + QRIS.
   * Final: Cash + QRIS + Transfer + Debit.
   */
  paymentExtended: isFinal,

  /**
   * Tombol Refund di riwayat transaksi.
   * V1: hanya Void (cancel tanpa uang kembali).
   * Final: Void + Refund (dengan alasan wajib).
   */
  refund: isFinal,

  /**
   * Engine promo BOGO / Buy2Get1.
   * V1: tidak load promo_rule dari DB, cart = cartRaw.
   * Final: load + apply promo, item gratis muncul di keranjang.
   */
  promoEngine: isFinal,

  /**
   * Load preset diskon dari DB.
   * V1: hardcoded [5, 10, 15, 20]% — preset_id = null saat simpan.
   * Final: load dari tabel diskon_preset — preset_id tersimpan di DB.
   */
  diskonDariDB: isFinal,

  /**
   * Card "Preset Diskon" + "Program Promo" di halaman Pengaturan.
   * V1: disembunyikan (link tidak muncul).
   * Final: muncul, owner bisa kelola preset dan promo.
   */
  pengaturanLanjutan: isFinal,
} as const;
