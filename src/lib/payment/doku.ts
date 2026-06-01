// ─────────────────────────────────────────────────────────────────────────────
// DOKU adapter — SNAP "QRIS MPM Generate" (QR inline / qrContent). Berdasarkan docs DOKU.
//
// ⚠️ PENTING — DOKU paling berbeda dari Xendit/Midtrans:
//   • QR INLINE (string mentah) hanya keluar dari SNAP QRIS MPM Generate.
//     (DOKU "Checkout" cuma mengembalikan payment.url / halaman redirect → langgar R1.)
//   • SNAP butuh 2 langkah: (1) ambil B2B access-token via signature ASIMETRIS
//     (RSA-SHA256 dgn PRIVATE KEY merchant), (2) generate QRIS via signature
//     SIMETRIS (HMAC-SHA512 dgn CLIENT SECRET) + Bearer token.
//   • Artinya DOKU butuh TIGA rahasia: Client-Id, Client Secret, RSA Private Key —
//     lebih dari satu "API key". Model kredensial saat ini menampungnya sbg:
//        apiKey       = "ClientId:ClientSecret"
//        webhookToken = base64(PEM private key RSA)   ← dipakai utk tanda tangan token
//   • Endpoint/CHANNEL-ID/merchantId & format minify/timestamp WAJIB diverifikasi di
//     sandbox DOKU akun Anda sebelum production. Bagian signature di bawah sudah
//     mengikuti spesifikasi DOKU, tapi tidak bisa di-runtime-verify dari sini.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  PGAdapter, PGCredential, CreateQrisArgs, QrisResult, PaymentStatus, WebhookResult, TestResult,
} from "./types";

// VERIFIKASI path ke docs SNAP DOKU akun Anda:
const TOKEN_PATH = "/authorization/v1/access-token/b2b";
const QRIS_PATH = "/snap-adapter/b2b/v1.0/qr/qr-mpm-generate";
const CHANNEL_ID = "95221"; // contoh; sesuaikan bila DOKU memberi nilai khusus

function baseUrl(mode: PGCredential["mode"]): string {
  return mode === "production" ? "https://api.doku.com" : "https://api-sandbox.doku.com";
}

function splitCred(apiKey: string): { clientId: string; clientSecret: string } {
  const i = apiKey.indexOf(":");
  if (i < 0) throw new Error('Kredensial DOKU: isi API key sebagai "ClientId:ClientSecret".');
  return { clientId: apiKey.slice(0, i).trim(), clientSecret: apiKey.slice(i + 1).trim() };
}

function privateKeyPem(cred: PGCredential): string {
  if (!cred.webhookToken) {
    throw new Error("DOKU butuh RSA private key (base64 PEM) di field webhook token.");
  }
  const raw = cred.webhookToken.trim();
  // boleh PEM mentah, atau base64 dari PEM
  if (raw.includes("BEGIN")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}

/** ISO8601 WIB dengan offset +07:00, presisi detik. */
function wibTimestamp(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 19) + "+07:00";
}

function sha256LowerHex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function externalId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

function mapStatus(code: string, desc?: string): PaymentStatus {
  const c = (code || "").trim();
  const d = (desc || "").toLowerCase();
  if (c === "00" || d === "success" || d === "successful") return "paid";
  if (c === "05" || d.includes("cancel")) return "failed";
  if (c === "03" || c === "06" || d.includes("fail")) return "failed";
  if (d.includes("expire")) return "expired";
  return "pending";
}

/** Pure parser notifikasi pembayaran SNAP QRIS DOKU. */
export function parseDokuWebhook(payload: unknown): WebhookResult {
  const p = (payload ?? {}) as Record<string, unknown>;
  const external_id = String(p.originalPartnerReferenceNo ?? p.partnerReferenceNo ?? "");
  const status = mapStatus(
    String(p.latestTransactionStatus ?? ""),
    String(p.transactionStatusDesc ?? "")
  );
  return { external_id, status, raw: payload };
}

export class DokuAdapter implements PGAdapter {
  readonly provider = "doku" as const;
  constructor(private cred: PGCredential) {}

  /** Langkah 1: B2B access token (signature ASIMETRIS RSA-SHA256). */
  private async getToken(): Promise<string> {
    const { clientId } = splitCred(this.cred.apiKey);
    const timestamp = wibTimestamp();
    const stringToSign = `${clientId}|${timestamp}`;
    const signature = crypto
      .sign("RSA-SHA256", Buffer.from(stringToSign, "utf8"), privateKeyPem(this.cred))
      .toString("base64");

    const res = await fetch(`${baseUrl(this.cred.mode)}${TOKEN_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CLIENT-KEY": clientId,
        "X-TIMESTAMP": timestamp,
        "X-SIGNATURE": signature,
      },
      body: JSON.stringify({ grantType: "client_credentials" }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const token = json.accessToken as string | undefined;
    if (!res.ok || !token) {
      throw new Error(`DOKU token gagal: ${json.responseMessage ?? res.status}`);
    }
    return token;
  }

  async createQris({ amount, orderId, label }: CreateQrisArgs): Promise<QrisResult> {
    const { clientId, clientSecret } = splitCred(this.cred.apiKey);
    const token = await this.getToken();
    const timestamp = wibTimestamp();
    const validUntil = new Date(Date.now() + 15 * 60_000 + 7 * 3600 * 1000)
      .toISOString().slice(0, 19) + "+07:00";

    // VERIFIKASI bentuk body SNAP QRIS MPM akun Anda (mis. merchantId bila diwajibkan).
    const bodyObj = {
      partnerReferenceNo: orderId,
      amount: { value: amount.toFixed(2), currency: "IDR" },
      validityPeriod: validUntil,
      additionalInfo: { label: label.slice(0, 64) },
    };
    const rawBody = JSON.stringify(bodyObj);
    const stringToSign = `POST:${QRIS_PATH}:${token}:${sha256LowerHex(rawBody)}:${timestamp}`;
    const signature = crypto.createHmac("sha512", clientSecret).update(stringToSign, "utf8").digest("base64");

    const res = await fetch(`${baseUrl(this.cred.mode)}${QRIS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-TIMESTAMP": timestamp,
        "X-SIGNATURE": signature,
        "X-PARTNER-ID": clientId,
        "X-EXTERNAL-ID": externalId(),
        "CHANNEL-ID": CHANNEL_ID,
      },
      body: rawBody,
    });
    const json = (await res.json()) as Record<string, unknown>;
    const qrContent = (json.qrContent as string) ?? "";
    if (!res.ok || !qrContent) {
      throw new Error(`DOKU createQris gagal: ${json.responseMessage ?? res.status}`);
    }
    return {
      qr_string: qrContent,
      qr_url: (json.qrUrl as string) ?? undefined,
      external_id: orderId, // cocokkan webhook via originalPartnerReferenceNo
      expires_at: validUntil,
    };
  }

  async checkStatus(): Promise<PaymentStatus> {
    // SNAP punya endpoint inquiry tersendiri; andalkan webhook. Fallback: pending.
    return "pending";
  }

  verifyWebhook(payload: unknown, headers: Record<string, string>): boolean {
    try {
      const { clientSecret } = splitCred(this.cred.apiKey);
      const incoming = headers["x-signature"] ?? "";
      const timestamp = headers["x-timestamp"] ?? "";
      const target = headers["request-target"] ?? "/api/payment/webhook/doku";
      const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
      const stringToSign = `POST:${target}:${sha256LowerHex(rawBody)}:${timestamp}`;
      const expected = crypto.createHmac("sha512", clientSecret).update(stringToSign, "utf8").digest("base64");
      const a = Buffer.from(incoming);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhook(payload: unknown): WebhookResult {
    return parseDokuWebhook(payload);
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.getToken(); // sukses = clientId + private key valid
      return { ok: true, message: `DOKU terhubung (${this.cred.mode}).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Gagal menghubungi DOKU." };
    }
  }
}
