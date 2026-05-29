"use client";

import type { MenuItem } from "@/lib/db/menu";
import { formatRupiah } from "@/lib/utils/currency";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MenuItemCard({
  item,
  namaKategori,
  onEdit,
  onToggle,
}: {
  item: MenuItem;
  namaKategori?: string;
  onEdit: () => void;
  onToggle: (isAvailable: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button onClick={onEdit} className="flex flex-1 items-start gap-3 text-left">
        <div className="flex-1">
          <p className={cn("font-semibold", !item.is_available && "text-muted-foreground line-through")}>
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

      {/* Toggle is_available — ketersediaan harian */}
      <button
        onClick={() => onToggle(!item.is_available)}
        role="switch"
        aria-checked={item.is_available}
        aria-label="Ketersediaan hari ini"
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          item.is_available ? "bg-accent" : "bg-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            item.is_available ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>

      <button
        onClick={onEdit}
        aria-label="Edit"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
