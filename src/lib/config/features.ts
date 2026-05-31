/**
 * Feature flags — satu ENV var mengontrol V1 vs V2 experience.
 *
 * .env.local / hosting env:
 *   NEXT_PUBLIC_POS_VERSION=v1  → V1 (default, aman untuk early launch)
 *   NEXT_PUBLIC_POS_VERSION=v2  → V2 (semua fitur aktif)
 *
 * Flip: ubah ENV → redeploy → selesai.
 *
 * ── Selaras 1:1 dengan versi React Native (battle-tested) ────
 *
 * | Fitur                                   | V1  | V2  |
 * |-----------------------------------------|-----|-----|
 * | Pilih metode bayar + uang/kembalian     | ❌  | ✅  |  (V1: tunai langsung)
 * | Void transaksi                          | ✅  | ✅  |
 * | Refund transaksi                        | ❌  | ✅  |
 * | Preset diskon (dari DB)                 | ✅  | ✅  |  ← SAMA di V1 dan V2
 * | Kelola preset diskon                    | ✅  | ✅  |  ← SAMA di V1 dan V2
 * | BOGO / Buy2Get1                         | ❌  | ✅  |
 * | Kelola program promo                    | ❌  | ✅  |
 */

const VERSION = (process.env.NEXT_PUBLIC_POS_VERSION ?? "v1").trim().toLowerCase();
const isV2 = VERSION === "v2";

export const features = {
  /**
   * Pilihan metode bayar (QRIS/Transfer/Debit) + input uang & kembalian.
   * V1: tidak ada pilihan metode — transaksi langsung dicatat sebagai TUNAI.
   * V2: Tunai + QRIS + Transfer + Debit, lengkap dengan uang diterima & kembalian.
   */
  payment: isV2,

  /**
   * Tombol Refund di riwayat transaksi.
   * V1: hanya Void.
   * V2: Void + Refund (dengan alasan wajib).
   */
  refund: isV2,

  /**
   * Engine promo BOGO / Buy2Get1.
   * V1: tidak aktif — cart tidak diproses promo engine.
   * V2: aktif — item gratis otomatis muncul di keranjang.
   */
  promoEngine: isV2,

  /**
   * Card "Program Promo" di halaman Pengaturan.
   * V1: disembunyikan — fitur BOGO belum aktif.
   * V2: muncul — owner bisa kelola promo BOGO.
   *
   * CATATAN: Card "Preset Diskon" TIDAK dipengaruhi flag ini.
   * Preset diskon dari DB aktif di V1 dan V2.
   */
  promoManagement: isV2,
} as const;
