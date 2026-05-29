"use client";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import DiskonInput from "./diskon-input";
import type { CartItem } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";
import { Minus, Plus, Trash2 } from "lucide-react";

export default function KeranjangPanel({
  open,
  onOpenChange,
  cart,
  onUbahQty,
  onHapus,
  diskonPersen,
  onDiskonChange,
  catatan,
  onCatatanChange,
  onBayar,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  onUbahQty: (menuItemId: string | null, delta: number) => void;
  onHapus: (menuItemId: string | null) => void;
  diskonPersen: number;
  onDiskonChange: (persen: number) => void;
  catatan: string;
  onCatatanChange: (v: string) => void;
  onBayar: () => void;
  saving: boolean;
}) {
  const subtotal = cart.reduce((s, c) => s + c.harga_satuan * c.qty, 0);
  const diskonNominal = Math.round((subtotal * diskonPersen) / 100);
  const grandTotal = subtotal - diskonNominal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" className="mx-auto max-w-2xl">
      <div className="border-b border-border p-4 pr-12">
        <h2 className="text-lg font-bold">Keranjang</h2>
        <p className="text-sm text-muted-foreground">
          {cart.reduce((s, c) => s + c.qty, 0)} item
        </p>
      </div>

      {/* Daftar item */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cart.map((c) => (
          <div key={c.menu_item_id ?? c.nama_produk} className="flex items-center gap-3 py-2.5">
            <div className="flex-1">
              <p className="font-semibold leading-tight">{c.nama_produk}</p>
              <p className="text-sm text-muted-foreground">{formatRupiah(c.harga_satuan)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onUbahQty(c.menu_item_id, -1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                aria-label="Kurangi"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{c.qty}</span>
              <button
                onClick={() => onUbahQty(c.menu_item_id, 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                aria-label="Tambah"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="w-24 text-right font-bold">{formatRupiah(c.harga_satuan * c.qty)}</div>

            <button
              onClick={() => onHapus(c.menu_item_id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
              aria-label="Hapus item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <Separator className="my-3" />

        <DiskonInput value={diskonPersen} onChange={onDiskonChange} label="Diskon transaksi" />

        <div className="mt-3">
          <Input
            value={catatan}
            onChange={(e) => onCatatanChange(e.target.value)}
            placeholder="Catatan (opsional)"
            className="h-10"
          />
        </div>
      </div>

      {/* Footer total + bayar */}
      <div className="mt-auto border-t border-border bg-card p-4">
        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
        {diskonNominal > 0 && (
          <div className="mb-1 flex justify-between text-sm text-primary">
            <span>Diskon {diskonPersen}%</span>
            <span>- {formatRupiah(diskonNominal)}</span>
          </div>
        )}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-extrabold text-primary">{formatRupiah(grandTotal)}</span>
        </div>
        <Button size="lg" className="w-full" onClick={onBayar} disabled={saving || cart.length === 0}>
          {saving ? "Memproses…" : `Bayar · ${formatRupiah(grandTotal)}`}
        </Button>
      </div>
    </Sheet>
  );
}
