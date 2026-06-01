// ─────────────────────────────────────────────────────────────────────────────
// Midtrans adapter — Core API /v2/charge (payment_type "qris"). Diverifikasi thd docs.
//   Base   : prod https://api.midtrans.com | sandbox https://api.sandbox.midtrans.com  (dari mode)
//   Auth   : HTTP Basic base64(SERVER_KEY + ":")
//   Body   : { payment_type:"qris", transaction_details:{order_id,gross_amount}, qris:{acquirer:"gopay"}, custom_expiry }
//   Resp   : { status_code:"201", transaction_status:"pending", qr_string, actions:[{name:"generate-qr-code",url}] }
//   Status : GET /v2/{order_id}/status → transaction_status (settlement/capture=paid, expire=expired, deny/cancel/failure=failed)
//   Webhook: signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)  → cocokkan dgn payload.signature_key
// orderId yang kita kirim = payment_session.id → juga jadi external_id.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  PGAdapter, PGCredential, CreateQrisArgs, QrisResult, PaymentStatus, WebhookResult, TestResult,
} from "./types";

const QRIS_TTL_MIN = 15;

function baseUrl(mode: PGCredential["mode"]): string {
  return mode === "production" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}
function basicAuth(serverKey: string): string {
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}
function mapStatus(s: string, fraud?: string): PaymentStatus {
  const v = (s || "").toLowerCase();
  if (v === "settlement" || (v === "capture" && (fraud ?? "accept") === "accept")) return "paid";
  if (v === "expire") return "expired";
  if (v === "deny" || v === "cancel" || v === "failure") return "failed";
  return "pending";
}

/** Pure parser untuk ambil external_id/status sebelum verify. */
export function parseMidtransWebhook(payload: unknown): WebhookResult {
  const p = (payload ?? {}) as Record<string, unknown>;
  const external_id = String(p.order_id ?? "");
  const status = mapStatus(String(p.transaction_status ?? ""), String(p.fraud_status ?? ""));
  return { external_id, status, raw: payload };
}

export class MidtransAdapter implements PGAdapter {
  readonly provider = "midtrans" as const;
  constructor(private cred: PGCredential) {}

  async createQris({ amount, orderId }: CreateQrisArgs): Promise<QrisResult> {
    const res = await fetch(`${baseUrl(this.cred.mode)}/v2/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: basicAuth(this.cred.apiKey),
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: { order_id: orderId, gross_amount: amount },
        qris: { acquirer: "gopay" },
        custom_expiry: { expiry_duration: QRIS_TTL_MIN, unit: "minute" },
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !["200", "201"].includes(String(json.status_code))) {
      throw new Error(`Midtrans createQris gagal: ${json.status_message ?? res.status}`);
    }
    const actions = (json.actions ?? []) as { name: string; url: string }[];
    const qrUrl = actions.find((a) => a.name === "generate-qr-code")?.url;
    const expires = (json.expiry_time as string) ?? new Date(Date.now() + QRIS_TTL_MIN * 60_000).toISOString();
    return {
      qr_string: String(json.qr_string ?? ""),
      qr_url: qrUrl,
      external_id: orderId,
      expires_at: new Date(expires).toISOString(),
    };
  }

  async checkStatus(externalId: string): Promise<PaymentStatus> {
    const res = await fetch(`${baseUrl(this.cred.mode)}/v2/${encodeURIComponent(externalId)}/status`, {
      headers: { Accept: "application/json", Authorization: basicAuth(this.cred.apiKey) },
    });
    if (!res.ok && res.status !== 404) return "pending";
    const json = (await res.json()) as Record<string, unknown>;
    return mapStatus(String(json.transaction_status ?? ""), String(json.fraud_status ?? ""));
  }

  verifyWebhook(payload: unknown): boolean {
    const p = (payload ?? {}) as Record<string, unknown>;
    const orderId = String(p.order_id ?? "");
    const statusCode = String(p.status_code ?? "");
    const grossAmount = String(p.gross_amount ?? ""); // string ber-desimal, mis. "38000.00"
    const sig = String(p.signature_key ?? "");
    if (!orderId || !sig) return false;
    const expected = crypto
      .createHash("sha512")
      .update(orderId + statusCode + grossAmount + this.cred.apiKey)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseWebhook(payload: unknown): WebhookResult {
    return parseMidtransWebhook(payload);
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await fetch(`${baseUrl(this.cred.mode)}/v2/ping-${Date.now()}/status`, {
        headers: { Accept: "application/json", Authorization: basicAuth(this.cred.apiKey) },
      });
      if (res.status === 401) return { ok: false, message: "Server Key Midtrans salah." };
      return { ok: true, message: `Midtrans terhubung (${this.cred.mode}).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Gagal menghubungi Midtrans." };
    }
  }
}
