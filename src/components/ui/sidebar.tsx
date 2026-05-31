"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// ──────────────────────────────────────────────────────────────────────
//  Sidebar — versi ringkas dari shadcn/ui sidebar.
//  Desktop (md+): rail tetap, lebar collapse (icon) ↔ expanded (icon+label).
//  Mobile (< md): muncul sebagai Sheet kiri (dipakai opsional; POS ini
//  memakai bottom-nav untuk mobile, jadi Sheet hanya fallback).
//
//  Lebar dikontrol via CSS var agar SATU sumber kebenaran (selesaikan
//  masalah magic-number lama di app-shell + kasir floating button).
// ──────────────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = "13rem"; // expanded (≈208px, dekat 200px lama)
const SIDEBAR_WIDTH_ICON = "4.5rem"; // icon-only (72px lama)

type SidebarContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (v: boolean) => void;
  isMobile: boolean;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar harus dipakai di dalam <SidebarProvider>");
  return ctx;
}

export function SidebarProvider({
  defaultOpen = true,
  children,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = React.useCallback(() => {
    if (isMobile) setOpenMobile((v) => !v);
    else setOpen((v) => !v);
  }, [isMobile]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({ open, setOpen, openMobile, setOpenMobile, isMobile, toggle }),
    [open, openMobile, isMobile, toggle]
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-sidebar-state={open ? "expanded" : "collapsed"}
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("flex min-h-dvh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[var(--sidebar-width)] bg-card p-0"
          showClose={false}
        >
          <div className="flex h-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "group/sidebar hidden shrink-0 border-r border-border bg-card/95 backdrop-blur transition-[width] duration-200 ease-in-out md:flex md:flex-col",
        "print:hidden",
        open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex h-16 shrink-0 items-center border-b border-border", className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3", className)}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shrink-0 border-t border-border px-2 py-3", className)}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("relative", className)} {...props} />;
}

export function SidebarMenuButton({
  className,
  isActive,
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & { isActive?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-active={isActive ? "true" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        className
      )}
      {...(props as React.HTMLAttributes<HTMLButtonElement>)}
    />
  );
}

/** Konten utama yang otomatis mengisi sisa lebar di sebelah Sidebar. */
export function SidebarInset({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative flex min-h-dvh w-full flex-1 flex-col", className)}
      {...props}
    />
  );
}
