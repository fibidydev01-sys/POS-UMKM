"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "right" | "bottom";
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, side = "right", children, className }: SheetProps) {
  const [render, setRender] = React.useState(open);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = "hidden";
      return () => cancelAnimationFrame(r);
    } else {
      setShow(false);
      document.body.style.overflow = "";
      const t = setTimeout(() => setRender(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  if (!render) return null;

  const sideCls =
    side === "bottom"
      ? cn("inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t", show ? "translate-y-0" : "translate-y-full")
      : cn("inset-y-0 right-0 w-full max-w-md border-l", show ? "translate-x-0" : "translate-x-full");

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200", show ? "opacity-100" : "opacity-0")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute flex flex-col bg-card shadow-2xl transition-transform duration-200 ease-out",
          sideCls,
          className
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Tutup"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-border p-5 pr-12", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto border-t border-border p-4", className)} {...props} />;
}
