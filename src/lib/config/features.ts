// Feature flip per-deployment lewat SATU env var (client-visible).
// v1 = dasar | v2 = +payment/refund/promo | v3 = +QRIS connector.
// V3 = SUPERSET V2 (tier cascading): semua fitur v2 tetap nyala di v3.
const VERSION = (process.env.NEXT_PUBLIC_POS_VERSION ?? "v1").trim().toLowerCase();
const tier = VERSION === "v3" ? 3 : VERSION === "v2" ? 2 : 1;

export const features = {
  // V2+
  payment: tier >= 2,
  refund: tier >= 2,
  promoEngine: tier >= 2,
  promoManagement: tier >= 2,
  // V3+
  qrisPayment: tier >= 3, // metode QRIS (PG connector) muncul di kasir
  pgConnector: tier >= 3, // halaman setup Payment Gateway di Pengaturan
} as const;
