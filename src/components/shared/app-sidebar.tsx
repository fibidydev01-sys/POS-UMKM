"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV, isPathActive } from "./nav-config";

/**
 * AppSidebar — desktop rail (md+). Lebar diatur oleh primitive via CSS var,
 * jadi konten (SidebarInset) otomatis ter-offset tanpa magic-number.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { open, setOpenMobile, isMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader
        className={cn("px-3 transition-all", open ? "justify-start" : "justify-center")}
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <span
          className={cn(
            "ml-3 text-sm font-extrabold transition-opacity",
            open ? "opacity-100" : "hidden opacity-0"
          )}
        >
          POS UMKM
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isPathActive(pathname, href);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link href={href} title={label} onClick={handleClick}>
                    <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
                    <span
                      className={cn(
                        "text-sm font-semibold transition-opacity",
                        open ? "opacity-100" : "hidden opacity-0",
                        active && "font-bold"
                      )}
                    >
                      {label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2",
            !open && "justify-center px-0"
          )}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            U
          </div>
          <span
            className={cn(
              "text-xs text-muted-foreground transition-opacity",
              open ? "opacity-100" : "hidden opacity-0"
            )}
          >
            Owner
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
