"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { HIDDEN_NAV_PATHS } from "./nav-config";

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
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
