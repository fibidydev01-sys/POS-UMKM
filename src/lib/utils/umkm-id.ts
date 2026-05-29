// Get/clear umkm_id dari cookie (client-side).
// Cookie di-set oleh /api/aktivasi. Bukan rahasia — hanya penanda tenant.

export const COOKIE_UMKM = "umkm_id";

export function getUmkmId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)umkm_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function clearUmkmId(): void {
  if (typeof document === "undefined") return;
  document.cookie = "umkm_id=; Path=/; Max-Age=0; SameSite=Lax";
}
