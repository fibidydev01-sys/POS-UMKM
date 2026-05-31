"use client";

import type { MenuItem } from "@/lib/db/menu";
import { formatRupiah } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * MenuItemCard — tap baris mana saja = buka edit drawer.
 * Pensil icon dihapus — user sudah intuitif tap = edit.
 * Switch tetap ada untuk toggle ketersediaan harian.
 */
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
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
    >
      {/* Area teks — seluruhnya bisa di-tap untuk edit */}
      <button
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
        aria-label={`Edit ${item.nama}`}
      >
        <p
          className={cn(
            "font-semibold leading-snug",
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
      </button>

      {/* Toggle ketersediaan — stop propagation agar tidak trigger onEdit */}
      <Switch
        checked={item.is_available}
        onCheckedChange={onToggle}
        disabled={toggling}
        aria-label="Ketersediaan hari ini"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
