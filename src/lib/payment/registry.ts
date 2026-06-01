// ─────────────────────────────────────────────────────────────────────────────
// PG Registry (R4). Satu-satunya tempat yang "tahu" daftar PG.
// Tambah PG baru: import adapter + parser, tambahkan ke dua map di bawah.
// ─────────────────────────────────────────────────────────────────────────────

import type { PGAdapter, PGCredential, Provider, WebhookResult } from "./types";
import { XenditAdapter, parseXenditWebhook } from "./xendit";
import { MidtransAdapter, parseMidtransWebhook } from "./midtrans";
import { DokuAdapter, parseDokuWebhook } from "./doku";

type Factory = (c: PGCredential) => PGAdapter;

const ADAPTERS: Record<Provider, Factory> = {
  xendit: (c) => new XenditAdapter(c),
  midtrans: (c) => new MidtransAdapter(c),
  doku: (c) => new DokuAdapter(c),
};

const WEBHOOK_PARSERS: Record<Provider, (p: unknown) => WebhookResult> = {
  xendit: parseXenditWebhook,
  midtrans: parseMidtransWebhook,
  doku: parseDokuWebhook,
};

export const SUPPORTED_PROVIDERS = Object.keys(ADAPTERS) as Provider[];

export function isProvider(v: string): v is Provider {
  return (SUPPORTED_PROVIDERS as string[]).includes(v);
}

export function getAdapter(cred: PGCredential): PGAdapter {
  const f = ADAPTERS[cred.provider];
  if (!f) throw new Error(`Provider tidak didukung: ${cred.provider}`);
  return f(cred);
}

/** Ambil external_id/status TANPA secret (untuk cari session sebelum verify). */
export function peekWebhook(provider: Provider, payload: unknown): WebhookResult {
  const p = WEBHOOK_PARSERS[provider];
  if (!p) throw new Error(`Provider tidak didukung: ${provider}`);
  return p(payload);
}
