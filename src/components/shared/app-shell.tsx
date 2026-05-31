"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  ShoppingCart,
  UtensilsCrossed,
  ReceiptText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Navigasi — urutan & label selaras dengan tab bar React Native ──
const NAV = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/riwayat", label: "Riwayat", icon: ReceiptText },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

// Path yang tidak menampilkan navigasi sama sekali
const HIDDEN = ["/", "/aktivasi"];

// ──────────────────────────────────────────────────────────────────────
//  AppShell
//
//  Layout dua mode:
//
//  MOBILE (portrait, < 768 px):
//    - children mengisi layar penuh
//    - BottomNav fixed di bawah (height 58 px)
//    - padding-bottom pada children agar konten tidak tertutup nav
//
//  TABLET (landscape, ≥ 768 px):
//    - SideNav fixed di kiri (width 72 px — icon only)
//    - children mengisi sisa lebar (margin-left 72 px)
//    - SideNav expanded secara opsional di lebar ≥ 1024 px (width 200 px)
//
//  Kenapa 72 px (bukan 240 px)?
//    Tablet portrait biasanya ~768 px. Sidebar penuh 240 px memakan
//    30 % lebar — terlalu boros untuk POS yang butuh area konten luas.
//    72 px = icon saja; cukup untuk orientasi cepat tanpa membuang ruang.
//    Di ≥ 1024 px (tablet landscape besar / desktop) sidebar melebar ke
//    200 px dan label teks muncul.
// ──────────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !HIDDEN.includes(pathname);

  return (
    <>
      {/* ── TABLET SIDEBAR (hidden di mobile, visible di md+) ── */}
      {showNav && (
        <aside
          className={cn(
            // Selalu tersembunyi di mobile portrait
            "hidden",
            // Tampil mulai md (≥768px) — diasumsikan landscape untuk tablet
            "md:flex md:flex-col",
            // Posisi fixed, full height
            "fixed inset-y-0 left-0 z-40",
            // Lebar: 72px di md-lg, 200px di xl+
            "w-[72px] xl:w-[200px]",
            // Visual
            "border-r border-border bg-card/95 backdrop-blur",
            "print:hidden"
          )}
        >
          {/* Brand / logo area */}
          <div
            className={cn(
              "flex h-16 shrink-0 items-center justify-center border-b border-border px-3",
              "xl:justify-start xl:px-5"
            )}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <span className="ml-3 hidden text-sm font-extrabold xl:block">
              POS UMKM
            </span>
          </div>

          {/* Nav items */}
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3 xl:px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    // Basis: centered icon, full width, pill shape
                    "flex items-center justify-center rounded-xl py-3 transition-colors",
                    "xl:justify-start xl:gap-3 xl:px-3",
                    // Aktif vs tidak aktif
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active && "stroke-[2.5]"
                    )}
                  />
                  <span
                    className={cn(
                      "hidden text-sm font-semibold xl:block",
                      active && "font-bold"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer sidebar */}
          <div className="shrink-0 border-t border-border px-2 py-3 xl:px-3">
            <div
              className={cn(
                "flex items-center justify-center rounded-xl py-2 xl:justify-start xl:gap-3 xl:px-3"
              )}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                U
              </div>
              <span className="hidden text-xs text-muted-foreground xl:block">
                Owner
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ── KONTEN UTAMA ── */}
      <main
        className={cn(
          // Mobile: padding bawah untuk bottom nav
          showNav && "pb-[58px]",
          // Tablet md+: margin kiri mengikuti lebar sidebar icon (72px)
          showNav && "md:ml-[72px] md:pb-0",
          // Tablet xl+: margin kiri mengikuti lebar sidebar dengan label (200px)
          showNav && "xl:ml-[200px]",
          // Full min-height
          "min-h-dvh"
        )}
      >
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV (hidden di md+) ── */}
      {showNav && (
        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-40",
            "flex md:hidden",
            "border-t border-border bg-card/95 backdrop-blur",
            "print:hidden"
          )}
        >
          <div className="flex w-full items-stretch justify-around">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}