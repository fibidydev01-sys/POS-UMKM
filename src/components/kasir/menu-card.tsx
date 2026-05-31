"use client";

import type { MenuItem } from "@/lib/db/menu";
import { formatRupiah } from "@/lib/utils/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MenuLayout = "list" | "grid";

/**
 * MenuCard — kartu produk kasir, dukung 2 layout: grid & list.
 *
 * Aturan tampilan (final):
 *  - Belum ditekan (qty 0): HANYA nama + harga.
 *  - Setelah ditekan (qty > 0): muncul Badge qty. Tap lagi = nambah.
 *  - Tanpa aspect-square → tinggi ikut konten, teks tidak terpotong (BUG-04).
 */
export function MenuCard({
  item,
  qty,
  layout,
  onTambah,
}: {
  item: MenuItem;
  qty: number;
  layout: MenuLayout;
  onTambah: (item: MenuItem) => void;
}) {
  const active = qty > 0;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTambah(item);
    }
  };

  if (layout === "list") {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onTambah(item)}
        onKeyDown={handleKey}
        className={cn(
          "flex cursor-pointer items-center gap-3 p-3 transition-all outline-none",
          "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
          active && "border-primary ring-1 ring-primary/30"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">{item.nama}</p>
          <p className="text-sm font-bold text-primary">{formatRupiah(item.harga)}</p>
        </div>
        {active && (
          <Badge className="h-7 min-w-7 shrink-0 justify-center px-2 text-sm tabular-nums">
            {qty}
          </Badge>
        )}
      </Card>
    );
  }

  // grid
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onTambah(item)}
      onKeyDown={handleKey}
      className={cn(
        "relative flex min-h-[6.5rem] cursor-pointer flex-col justify-between gap-2 p-3 text-left transition-all outline-none",
        "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
        active && "border-primary ring-2 ring-primary/30"
      )}
    >
      {active && (
        <Badge className="absolute right-2 top-2 h-6 min-w-6 justify-center px-1.5 tabular-nums">
          {qty}
        </Badge>
      )}
      <span className="line-clamp-2 pr-7 text-sm font-semibold leading-snug">
        {item.nama}
      </span>
      <span className="text-sm font-bold text-primary">{formatRupiah(item.harga)}</span>
    </Card>
  );
}
