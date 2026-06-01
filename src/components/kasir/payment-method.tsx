"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { parseRupiah, formatAngka, formatRupiah } from "@/lib/utils/currency";
import { features } from "@/lib/config/features";
import type { PaymentMethod } from "@/store/cart-store";
import { QrCode, AlertTriangle } from "lucide-react";

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
  autoQris = false,
  pgReady = false,
  onSetupGateway,
}: {
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  uangDiterima: string;
  onUangChange: (v: string) => void;
  grandTotal: number;
  /** V3: true bila QRIS lewat PG aktif → QR dibuat otomatis saat tekan Bayar. */
  autoQris?: boolean;
  /** V3: tenant punya gateway aktif. */
  pgReady?: boolean;
  /** Navigasi ke halaman setup gateway (Pengaturan → Pembayaran). */
  onSetupGateway?: () => void;
}) {
  const uangNum = parseRupiah(uangDiterima);
  const isCash = method === "cash";
  const kembalian = isCash && uangNum >= grandTotal ? uangNum - grandTotal : null;

  // V3 build, metode QRIS dipilih, tapi belum ada gateway aktif → arahkan ke setup.
  const qrisNeedsSetup = features.qrisPayment && method === "qris" && !pgReady;

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
      ) : qrisNeedsSetup ? (
        <div className="mt-1 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-warning">Gateway QRIS belum terhubung</p>
              <p className="text-xs text-warning/80">
                Hubungkan Payment Gateway dulu agar QR otomatis muncul saat bayar.
              </p>
            </div>
          </div>
          {onSetupGateway && (
            <button
              type="button"
              onClick={onSetupGateway}
              className="inline-flex items-center gap-1.5 self-start rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-warning/90"
            >
              <QrCode className="h-3.5 w-3.5" /> Setup Gateway QRIS
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1 rounded-lg bg-secondary/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {method === "qris"
              ? autoQris
                ? "QR QRIS dibuat otomatis saat menekan Bayar. Pelanggan tinggal scan."
                : "Tunjukkan QR ke pelanggan. Konfirmasi setelah pembayaran berhasil."
              : `Konfirmasi setelah dana ${PAYMENT_LABELS[method]} masuk / disetujui.`}
          </p>
        </div>
      )}
    </div>
  );
}
