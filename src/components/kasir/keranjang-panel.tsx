"use client";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import DiskonInput from "./diskon-input";
import type { CartItem } from "@/lib/db/transaksi";
import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { formatRupiah, parseRupiah, formatAngka } from "@/lib/utils/currency";
import { hitungGrandTotal } from "@/lib/cart/promo-engine";
import { features } from "@/lib/config/features";
import { Minus, Plus, Trash2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const PAYMENT_LABELS: Record<string, string> = {
  cash:     "💵 Tunai",
  qris:     "📱 QRIS",
  transfer: "🏦 Transfer",
  debit:    "💳 Debit",
};

// V1: hanya cash + qris. V2: semua 4 metode.
const PAYMENT_METHODS_V1    = ["cash", "qris"] as const;
const PAYMENT_METHODS_V2 = ["cash", "qris", "transfer", "debit"] as const;

export default function KeranjangPanel({
  open, onOpenChange,
  cart, cartRaw,
  onUbahQty, onHapus,
  presets, diskonPresetId, diskonPersen, onDiskonChange,
  paymentMethod, onPaymentMethodChange,
  uangDiterima, onUangDiterimaChange,
  onBayar, saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cartRaw: CartItem[];
  onUbahQty: (menuItemId: string | null, delta: number) => void;
  onHapus: (menuItemId: string | null) => void;
  presets: DiskonPreset[];
  diskonPresetId: string | null;
  diskonPersen: number;
  onDiskonChange: (presetId: string | null, persen: number) => void;
  paymentMethod: "cash" | "qris" | "transfer" | "debit";
  onPaymentMethodChange: (method: "cash" | "qris" | "transfer" | "debit") => void;
  uangDiterima: string;
  onUangDiterimaChange: (v: string) => void;
  onBayar: () => void;
  saving: boolean;
}) {
  const { subtotal, diskonNominal, grandTotal } = hitungGrandTotal(cart, diskonPersen);
  const uangNum = parseRupiah(uangDiterima);
  const kembalian = paymentMethod === "cash" && uangNum >= grandTotal ? uangNum - grandTotal : null;

  const canBayar =
    cart.length > 0 &&
    !saving &&
    (paymentMethod !== "cash" || (uangNum >= grandTotal && grandTotal > 0));

  const promoFreeItems = cart.filter((c) => (c as any).item_type === "promo_free");
  const totalQtyRaw = cartRaw.reduce((s, c) => s + c.qty, 0);

  const paymentMethods = features.paymentExtended
    ? PAYMENT_METHODS_V2
    : PAYMENT_METHODS_V1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" className="mx-auto max-w-2xl">
      <div className="border-b border-border p-4 pr-12">
        <h2 className="text-lg font-bold">Keranjang</h2>
        <p className="text-sm text-muted-foreground">{totalQtyRaw} item</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Item yang dipilih kasir (cartRaw) — bisa ubah qty */}
        {cartRaw.map((c) => (
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
              aria-label="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Item gratis dari promo — read-only */}
        {promoFreeItems.map((c, i) => (
          <div key={`promo-${i}`} className="flex items-center gap-3 py-1.5 opacity-80">
            <Gift className="h-4 w-4 shrink-0 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-accent leading-tight">{c.nama_produk}</p>
              <p className="text-xs text-accent/70">GRATIS (BOGO)</p>
            </div>
            <div className="text-sm font-bold text-accent">Rp 0</div>
          </div>
        ))}

        <Separator className="my-3" />

        <DiskonInput
          presets={presets}
          selectedId={diskonPresetId}
          selectedPersen={diskonPersen}
          onChange={onDiskonChange}
        />

        <Separator className="my-3" />

        {/* Metode bayar — V1: 2 opsi, Final: 4 opsi */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Metode bayar</span>
          <div className={cn(
            "grid gap-2",
            paymentMethods.length === 2 ? "grid-cols-2" : "grid-cols-2"
          )}>
            {paymentMethods.map((m) => (
              <button
                key={m}
                onClick={() => onPaymentMethodChange(m)}
                className={cn(
                  "rounded-xl border py-3 text-sm font-bold transition-colors",
                  paymentMethod === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-secondary"
                )}
              >
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Input uang — hanya cash */}
        {paymentMethod === "cash" && (
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Uang diterima</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <Input
                inputMode="numeric"
                value={uangDiterima}
                onChange={(e) => {
                  const n = parseRupiah(e.target.value);
                  onUangDiterimaChange(n > 0 ? formatAngka(n) : "");
                }}
                placeholder="0"
                className="pl-9 text-right font-bold"
                autoFocus
              />
            </div>
            {kembalian !== null && (
              <div className="flex justify-between rounded-lg bg-secondary px-3 py-2">
                <span className="text-sm font-semibold">Kembalian</span>
                <span className="text-sm font-bold text-accent">{formatRupiah(kembalian)}</span>
              </div>
            )}
            {uangNum > 0 && uangNum < grandTotal && (
              <p className="text-xs text-destructive">Uang kurang {formatRupiah(grandTotal - uangNum)}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-border bg-card p-4">
        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
        {promoFreeItems.length > 0 && (
          <div className="mb-1 flex justify-between text-sm text-accent">
            <span>Promo BOGO</span>
            <span>{promoFreeItems.length} item gratis</span>
          </div>
        )}
        {diskonNominal > 0 && (
          <div className="mb-1 flex justify-between text-sm text-primary">
            <span>Diskon {diskonPersen}%</span>
            <span>-{formatRupiah(diskonNominal)}</span>
          </div>
        )}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-extrabold text-primary">{formatRupiah(grandTotal)}</span>
        </div>
        <Button size="lg" className="w-full" onClick={onBayar} disabled={!canBayar}>
          {saving ? "Memproses…" : `Bayar · ${formatRupiah(grandTotal)}`}
        </Button>
      </div>
    </Sheet>
  );
}
