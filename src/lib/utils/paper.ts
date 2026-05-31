"use client";

// Lebar kertas struk — preferensi PER PERANGKAT (disimpan di localStorage).
// Di web, lebar kertas adalah setelan cetak yang melekat ke device/printer,
// jadi tidak perlu disinkronkan ke server. Default 58mm.
//
// Setara dengan field `paper_width` di versi React Native, namun karena web
// mencetak via browser, preferensi ini disimpan lokal per device.

const KEY = "paper_width";

export function getPaperWidth(): 58 | 80 {
  if (typeof window === "undefined") return 58;
  return window.localStorage.getItem(KEY) === "80" ? 80 : 58;
}

export function setPaperWidth(w: 58 | 80): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(w));
}
