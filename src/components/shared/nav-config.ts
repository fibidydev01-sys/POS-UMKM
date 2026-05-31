import { Home, ShoppingCart, UtensilsCrossed, ReceiptText, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/riwayat", label: "Riwayat", icon: ReceiptText },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export const HIDDEN_NAV_PATHS = ["/", "/aktivasi"];

export function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
