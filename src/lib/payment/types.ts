// ─────────────────────────────────────────────────────────────────────────────
// V3 Payment — kontrak inti (R4: adapter pattern).
// Kasir & API route TIDAK tahu PG spesifik; hanya tahu tipe-tipe di file ini.
// Tambah PG baru = tambah string di `Provider` + 1 file adapter + daftar registry.
// ─────────────────────────────────────────────────────────────────────────────

export type Provider = "xendit" | "midtrans" | "doku";

/** Kredensial tenant yang SUDAH di-decrypt. Hidup transient di server saja (R3). */
export interface PGCredential {
  provider: Provider;
  /** Untuk Xendit/Midtrans: secret/server key. Untuk DOKU: "ClientId:SecretKey". */
  apiKey: string;
  mode: "sandbox" | "production";
  /** Dipakai sebagian PG untuk verify webhook (mis. Xendit callback token). */
  webhookToken?: string;
}

export interface CreateQrisArgs {
  amount: number;     // rupiah, integer
  orderId: string;    // = payment_session.id (UUID), referensi kita ke PG
  label: string;      // nama UMKM / deskripsi singkat
}

export interface QrisResult {
  qr_string: string;     // payload QRIS mentah (untuk render QR di UI)
  qr_url?: string;       // sebagian PG kasih URL gambar QR langsung
  external_id: string;   // id transaksi di sistem PG (untuk polling & cocokkan webhook)
  expires_at: string;    // ISO timestamp TTL QR
}

export type PaymentStatus = "pending" | "paid" | "expired" | "failed";

export interface WebhookResult {
  external_id: string;
  status: PaymentStatus;
  raw: unknown;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export interface PGAdapter {
  readonly provider: Provider;
  /** Buat QRIS dinamis. Hanya QRIS — tidak ada VA/retail/card (R1). */
  createQris(args: CreateQrisArgs): Promise<QrisResult>;
  /** Cek status pembayaran (fallback polling; webhook tetap sumber kebenaran). */
  checkStatus(externalId: string): Promise<PaymentStatus>;
  /** Verifikasi signature/notifikasi PG (R5). WAJIB sebelum payload dipercaya. */
  verifyWebhook(payload: unknown, headers: Record<string, string>): boolean;
  /** Normalisasi payload webhook → bentuk seragam. Tidak butuh secret. */
  parseWebhook(payload: unknown): WebhookResult;
  /** Ping ringan ber-autentikasi untuk "Test Connection" di Pengaturan. */
  testConnection(): Promise<TestResult>;
}
