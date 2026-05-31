"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuLayout } from "./menu-card";

/**
 * LayoutToggle — ganti tampilan item kasir antara List & Grid.
 * Default List (di-set parent). Tidak dipersist — reset tiap buka.
 */
export function LayoutToggle({
  value,
  onChange,
}: {
  value: MenuLayout;
  onChange: (v: MenuLayout) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-label="Tampilan list"
        aria-pressed={value === "list"}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md transition-colors",
          value === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary"
        )}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-label="Tampilan grid"
        aria-pressed={value === "grid"}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md transition-colors",
          value === "grid"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary"
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}
