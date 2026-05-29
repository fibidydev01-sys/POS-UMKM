"use client";

import type { MenuItem } from "@/lib/db/menu";
import { formatRupiah } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

export default function MenuGrid({
  items,
  qtyMap,
  onTambah,
}: {
  items: MenuItem[];
  qtyMap: Record<string, number>;
  onTambah: (item: MenuItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 min-[700px]:grid-cols-4">
      {items.map((item) => {
        const qty = qtyMap[item.id] ?? 0;
        return (
          <button
            key={item.id}
            onClick={() => onTambah(item)}
            className={cn(
              "relative flex aspect-square flex-col justify-between rounded-xl border bg-card p-3 text-left transition-all active:scale-[0.97]",
              qty > 0 ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
            )}
          >
            {qty > 0 && (
              <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {qty}
              </span>
            )}
            <span className="line-clamp-3 text-sm font-semibold leading-snug">{item.nama}</span>
            <span className="text-sm font-bold text-primary">{formatRupiah(item.harga)}</span>
          </button>
        );
      })}
    </div>
  );
}
