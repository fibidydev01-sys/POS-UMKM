"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { parseRupiah, formatAngka, formatRupiah } from "@/lib/utils/currency";
import type { PaymentMethod } from "@/store/cart-store";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Debit",
};

const METHODS: PaymentMethod[] = ["cash", "qris", "transfer", "debit"];

export function PaymentMethodPicker({
  method,
  onMethodChange,
  uangDiterima,
  onUangChange,
  grandTotal,
}: {
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  uangDiterima: string;
  onUangChange: (v: string) => void;
  grandTotal: number;
}) {
  const uangNum = parseRupiah(uangDiterima);
  const isCash = method === "cash";
  const kembalian = isCash && uangNum >= grandTotal ? uangNum - grandTotal : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-muted-foreground">Metode bayar</span>
      <ToggleGroup
        type="single"
        value={method}
        onValueChange={(v) => v && onMethodChange(v as PaymentMethod)}
        className="grid grid-cols-2 gap-2"
      >
        {METHODS.map((m) => (
          <ToggleGroupItem key={m} value={m} className="h-11 w-full justify-center">
            {PAYMENT_LABELS[m]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isCash ? (
        <div className="mt-1 flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Uang diterima</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Rp
            </span>
            <Input
              inputMode="numeric"
              value={uangDiterima}
              onChange={(e) => {
                const n = parseRupiah(e.target.value);
                onUangChange(n > 0 ? formatAngka(n) : "");
              }}
              placeholder="0"
              className="pl-9 text-right font-bold"
            />
          </div>
          {kembalian !== null && (
            <div className="flex justify-between rounded-lg bg-secondary px-3 py-2">
              <span className="text-sm font-semibold">Kembalian</span>
              <span className="text-sm font-bold text-accent">{formatRupiah(kembalian)}</span>
            </div>
          )}
          {uangNum > 0 && uangNum < grandTotal && (
            <p className="text-xs text-destructive">
              Uang kurang {formatRupiah(grandTotal - uangNum)}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-1 rounded-lg bg-secondary/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {method === "qris"
              ? "Tunjukkan QR ke pelanggan. Konfirmasi setelah pembayaran berhasil."
              : `Konfirmasi setelah dana ${PAYMENT_LABELS[method]} masuk / disetujui.`}
          </p>
        </div>
      )}
    </div>
  );
}
