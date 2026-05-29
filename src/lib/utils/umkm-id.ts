// Get/set/clear umkm_id dan owner_id dari cookie (client-side).
// Cookie di-set oleh /api/aktivasi setelah aktivasi berhasil.
// Bukan rahasia — hanya penanda tenant dan user FK.
// Tidak ada Supabase Auth — identitas sepenuhnya via cookie ini.

export const COOKIE_UMKM  = "umkm_id";
export const COOKIE_OWNER = "owner_id";

const MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 tahun

export function getUmkmId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)umkm_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * UUID dari system user (role = owner) untuk UMKM ini.
 * Dipakai sebagai kasir_id, updated_by, dan void_by di semua operasi.
 * Di-set oleh /api/aktivasi setelah seed users berhasil.
 */
export function getOwnerId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)owner_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Simpan owner_id ke cookie.
 * Dipanggil dari /api/aktivasi setelah row users berhasil di-seed.
 * Tidak perlu dipanggil lagi setelah itu — cookie persist 5 tahun.
 */
export function setOwnerId(id: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `owner_id=${encodeURIComponent(id)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function clearUmkmId(): void {
  if (typeof document === "undefined") return;
  document.cookie = "umkm_id=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "owner_id=; Path=/; Max-Age=0; SameSite=Lax";
}
