"use client";

import type { CartItem } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, Gift } from "lucide-react";

/** Baris item pilihan kasir — editable (qty +/-, hapus). */
export function CartLine({
  item,
  onUbahQty,
  onHapus,
}: {
  item: CartItem;
  onUbahQty: (menuItemId: string | null, delta: number) => void;
  onHapus: (menuItemId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{item.nama_produk}</p>
        <p className="text-sm text-muted-foreground">{formatRupiah(item.harga_satuan)}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUbahQty(item.menu_item_id, -1)}
          aria-label="Kurangi"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-6 text-center font-bold tabular-nums">{item.qty}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUbahQty(item.menu_item_id, 1)}
          aria-label="Tambah"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="w-20 text-right font-bold sm:w-24">
        {formatRupiah(item.harga_satuan * item.qty)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
        onClick={() => onHapus(item.menu_item_id)}
        aria-label="Hapus"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Baris item gratis hasil promo — read-only. */
export function CartPromoLine({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center gap-3 py-1.5 opacity-90">
      <Gift className="h-4 w-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-accent">
          {item.nama_produk}
        </p>
        <p className="text-xs text-accent/70">GRATIS (BOGO)</p>
      </div>
      <div className="text-sm font-bold text-accent">Rp 0</div>
    </div>
  );
}
