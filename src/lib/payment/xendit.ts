// ─────────────────────────────────────────────────────────────────────────────
// Xendit adapter — QR Codes API v2 (QRIS dinamis). Diverifikasi thd docs resmi.
//   Create : POST https://api.xendit.co/qr_codes   header api-version: 2022-07-31
//   Auth   : HTTP Basic base64(SECRET_KEY + ":")   (sandbox xnd_development_… / live xnd_production_…)
//   Body   : { reference_id, type:"DYNAMIC", currency:"IDR", amount, expires_at? }
//   Resp   : { id:"qr_…", qr_string, status:"ACTIVE", expires_at }
//   Webhook: header x-callback-token == token verifikasi callback (per akun) → simpan di webhookToken.
//            payload (flat / atau dibungkus "data"): { qr_id:"qr_…", status:"SUCCEEDED", reference_id }
// Base URL sama untuk sandbox & production; yang membedakan KEY. `mode` informatif.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  PGAdapter, PGCredential, CreateQrisArgs, QrisResult, PaymentStatus, WebhookResult, TestResult,
} from "./types";

const BASE = "https://api.xendit.co";
const API_VERSION = "2022-07-31";
const TTL_MIN = 30; // TTL QR utk kasir (default Xendit 48 jam — terlalu lama utk POS)

function basicAuth(secretKey: string): string {
  return "Basic " + Buffer.from(secretKey + ":").toString("base64");
}

function mapStatus(s: string): PaymentStatus {
  const v = (s || "").toUpperCase();
  if (v === "SUCCEEDED" || v === "COMPLETED" || v === "PAID") return "paid";
  if (v === "EXPIRED" || v === "INACTIVE") return "expired";
  if (v === "FAILED") return "failed";
  return "pending";
}

/** Pure parser (juga dipakai registry sebelum verify untuk ambil external_id). */
export function parseXenditWebhook(payload: unknown): WebhookResult {
  const p = (payload ?? {}) as Record<string, unknown>;
  const data = (p.data ?? p) as Record<string, unknown>; // payload bisa flat / dibungkus "data"
  const external_id = String(data.qr_id ?? data.id ?? data.reference_id ?? "");
  const status = mapStatus(String(data.status ?? ""));
  return { external_id, status, raw: payload };
}

export class XenditAdapter implements PGAdapter {
  readonly provider = "xendit" as const;
  constructor(private cred: PGCredential) {}

  async createQris({ amount, orderId, label }: CreateQrisArgs): Promise<QrisResult> {
    const expires_at = new Date(Date.now() + TTL_MIN * 60_000).toISOString();
    const res = await fetch(`${BASE}/qr_codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(this.cred.apiKey),
        "api-version": API_VERSION,
      },
      body: JSON.stringify({
        reference_id: orderId,
        type: "DYNAMIC",
        currency: "IDR",
        amount,
        expires_at,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Xendit createQris gagal: ${json.message ?? res.status} (${label})`);
    }
    return {
      qr_string: String(json.qr_string ?? ""),
      external_id: String(json.id ?? orderId), // "qr_…" → dicocokkan dgn webhook qr_id
      expires_at: String(json.expires_at ?? expires_at),
    };
  }

  async checkStatus(externalId: string): Promise<PaymentStatus> {
    // Catatan: object QR sendiri ACTIVE/INACTIVE; status "paid" datang via webhook.
    const res = await fetch(`${BASE}/qr_codes/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: basicAuth(this.cred.apiKey), "api-version": API_VERSION },
    });
    if (!res.ok) return "pending";
    const json = (await res.json()) as Record<string, unknown>;
    return mapStatus(String(json.status ?? ""));
  }

  verifyWebhook(_payload: unknown, headers: Record<string, string>): boolean {
    const token = headers["x-callback-token"];
    if (!this.cred.webhookToken || !token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(this.cred.webhookToken);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseWebhook(payload: unknown): WebhookResult {
    return parseXenditWebhook(payload);
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await fetch(`${BASE}/balance`, {
        headers: { Authorization: basicAuth(this.cred.apiKey) },
      });
      if (res.ok) return { ok: true, message: "Xendit terhubung." };
      if (res.status === 401) return { ok: false, message: "Secret Key Xendit salah." };
      return { ok: false, message: `Xendit menolak (HTTP ${res.status}).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Gagal menghubungi Xendit." };
    }
  }
}
