// Semua nominal adalah Integer Rupiah — tanpa desimal/float.

/** 12800 → "Rp 12.800" */
export function formatRupiah(n: number): string {
  return "Rp " + formatAngka(n);
}

/** 12800 → "12.800" (pemisah ribuan Indonesia) */
export function formatAngka(n: number): string {
  return Math.round(n || 0).toLocaleString("id-ID");
}

/** "Rp 12.800" / "12800" → 12800 */
export function parseRupiah(s: string): number {
  const digits = (s || "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Hitung nominal diskon dari persen (dibulatkan ke Rupiah terdekat). */
export function hitungDiskonNominal(subtotal: number, persen: number): number {
  return Math.round((subtotal * (persen || 0)) / 100);
}
