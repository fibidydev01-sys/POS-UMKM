export const COOKIE_UMKM = "umkm_id";
export const COOKIE_OWNER = "owner_id";
const MAX_AGE = 60 * 60 * 24 * 365 * 5;

export function getUmkmId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)umkm_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getOwnerId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)owner_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function setOwnerId(id: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `owner_id=${encodeURIComponent(id)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function clearUmkmId(): void {
  if (typeof document === "undefined") return;
  document.cookie = "umkm_id=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "owner_id=; Path=/; Max-Age=0; SameSite=Lax";
}
