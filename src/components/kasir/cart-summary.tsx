"use client";

import { formatRupiah } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";

/**
 * CartSummary — ringkasan + tombol bayar. Label tombol menyesuaikan
 * V1 (tunai langsung) vs V2 (konfirmasi metode non-tunai).
 */
export function CartSummary({
  subtotal,
  diskonNominal,
  diskonPersen,
  grandTotal,
  promoFreeCount,
  canBayar,
  saving,
  showPayment,
  isNonCash,
  onBayar,
}: {
  subtotal: number;
  diskonNominal: number;
  diskonPersen: number;
  grandTotal: number;
  promoFreeCount: number;
  canBayar: boolean;
  saving: boolean;
  showPayment: boolean;
  isNonCash: boolean;
  onBayar: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-muted-foreground">
        <span>Subtotal</span>
        <span>{formatRupiah(subtotal)}</span>
      </div>
      {promoFreeCount > 0 && (
        <div className="mb-1 flex justify-between text-sm text-accent">
          <span>Promo BOGO</span>
          <span>{promoFreeCount} item gratis</span>
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
        {saving
          ? "Memproses…"
          : showPayment && isNonCash
            ? `Konfirmasi Bayar · ${formatRupiah(grandTotal)}`
            : `Bayar · ${formatRupiah(grandTotal)}`}
      </Button>
    </div>
  );
}
