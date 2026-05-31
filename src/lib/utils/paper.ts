"use client";

const KEY = "paper_width";

export function getPaperWidth(): 58 | 80 {
  if (typeof window === "undefined") return 58;
  return window.localStorage.getItem(KEY) === "80" ? 80 : 58;
}

export function setPaperWidth(w: 58 | 80): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(w));
}
