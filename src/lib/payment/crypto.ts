// ─────────────────────────────────────────────────────────────────────────────
// V3 Payment — enkripsi credentials (L1 / R3). SERVER-ONLY.
// JANGAN tambahkan "use client". Master key dari PG_ENCRYPTION_KEY (bukan NEXT_PUBLIC).
//
// Generate key sekali (lokal):
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const ALG = "aes-256-gcm";

export interface EncryptedSecret {
  key_ciphertext: string;
  key_iv: string;
  key_auth_tag: string;
}

function masterKey(): Buffer {
  const raw = process.env.PG_ENCRYPTION_KEY;
  if (!raw) throw new Error("PG_ENCRYPTION_KEY belum di-set di environment server.");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new Error("PG_ENCRYPTION_KEY harus 32 byte (base64 dari 32 random bytes).");
  }
  return k;
}

export function encryptSecret(plain: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    key_ciphertext: ct.toString("base64"),
    key_iv: iv.toString("base64"),
    key_auth_tag: tag.toString("base64"),
  };
}

export function decryptSecret(r: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(ALG, masterKey(), Buffer.from(r.key_iv, "base64"));
  decipher.setAuthTag(Buffer.from(r.key_auth_tag, "base64"));
  // .final() akan throw kalau auth tag tidak cocok → anti-tamper.
  const pt = Buffer.concat([
    decipher.update(Buffer.from(r.key_ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
