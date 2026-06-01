"use client";

import { formatRupiah } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";

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
  autoQris = false,
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
  /** V3: true bila jalur QRIS-via-PG aktif → label tombol "Bayar via QRIS". */
  autoQris?: boolean;
  onBayar: () => void;
}) {
  const label = saving
    ? "Memproses..."
    : autoQris
      ? `Bayar via QRIS · ${formatRupiah(grandTotal)}`
      : showPayment && isNonCash
        ? `Konfirmasi Bayar · ${formatRupiah(grandTotal)}`
        : `Bayar · ${formatRupiah(grandTotal)}`;

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
        {label}
      </Button>
    </div>
  );
}
