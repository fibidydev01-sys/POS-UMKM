"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, UtensilsCrossed, LayoutDashboard, ReceiptText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// Owner-only: satu nav untuk semua halaman. Tidak ada role kasir.
const NAV = [
  { href: "/kasir",      label: "Kasir",     icon: ShoppingCart },
  { href: "/menu",       label: "Menu",      icon: UtensilsCrossed },
  { href: "/dashboard",  label: "Statistik", icon: LayoutDashboard },
  { href: "/riwayat",    label: "Riwayat",   icon: ReceiptText },
  { href: "/pengaturan", label: "Atur",      icon: Settings },
];

const HIDDEN = ["/", "/aktivasi"];

export default function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN.includes(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
