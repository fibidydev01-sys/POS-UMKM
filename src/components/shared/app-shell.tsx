"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { HIDDEN_NAV_PATHS } from "./nav-config";

/**
 * AppShell — layout dua mode tanpa magic-number:
 *  - Desktop (md+): Sidebar rail + SidebarInset (offset otomatis via flex).
 *  - Mobile (< md): konten penuh + MobileNav fixed di bawah (pb-[56px]).
 *
 * Aktivasi & root tidak menampilkan navigasi.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !HIDDEN_NAV_PATHS.includes(pathname);

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile diberi ruang bawah untuk MobileNav; desktop tidak perlu. */}
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
