export function formatRupiah(n: number): string {
  return "Rp " + formatAngka(n);
}

export function formatAngka(n: number): string {
  return Math.round(n || 0).toLocaleString("id-ID");
}

export function parseRupiah(s: string): number {
  const digits = (s || "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function hitungDiskonNominal(subtotal: number, persen: number): number {
  return Math.round((subtotal * (persen || 0)) / 100);
}
