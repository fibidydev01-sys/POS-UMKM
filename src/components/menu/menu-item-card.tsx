"use client";

import type { MenuItem } from "@/lib/db/menu";
import { formatRupiah } from "@/lib/utils/currency";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function MenuItemCard({
  item,
  namaKategori,
  onEdit,
  onToggle,
  toggling = false,
}: {
  item: MenuItem;
  namaKategori?: string;
  onEdit: () => void;
  onToggle: (isAvailable: boolean) => void;
  toggling?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button onClick={onEdit} className="flex flex-1 items-start gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold",
              !item.is_available && "text-muted-foreground line-through"
            )}
          >
            {item.nama}
          </p>
          <p className="text-sm font-bold text-primary">{formatRupiah(item.harga)}</p>
          {namaKategori && (
            <p className="mt-0.5 text-xs text-muted-foreground">{namaKategori}</p>
          )}
          {!item.is_available && (
            <p className="mt-0.5 text-xs text-warning">Stok habis hari ini</p>
          )}
        </div>
      </button>

      {/* FIX BUG-05: shadcn Switch — a11y bawaan + disabled saat request jalan */}
      <Switch
        checked={item.is_available}
        onCheckedChange={onToggle}
        disabled={toggling}
        aria-label="Ketersediaan hari ini"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground"
        onClick={onEdit}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
