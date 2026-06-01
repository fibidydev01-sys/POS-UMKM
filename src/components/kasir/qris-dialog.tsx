"use client";

import * as React from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, RefreshCw, Loader2, ShieldCheck, ScanLine } from "lucide-react";
import { encodeQr, qrMatrixToSvg } from "@/lib/payment/qr-encoder";
import type { SessionState } from "@/hooks/use-payment-session";

interface QrisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: SessionState;
  qrString: string | null;
  qrUrl: string | null;
  secondsLeft: number;
  error: string | null;
  amount: number;
  label?: string;
  provider?: string | null;
  /** Force an immediate status check (manual "sudah bayar?"). */
  onCheckNow?: () => void;
  checking?: boolean;
  onRegenerate: () => void;
}

function fmtRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function fmtCountdown(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Renders a scannable QR from the raw QRIS string using the in-house encoder. */
function QrCanvas({ value, size = 232 }: { value: string; size?: number }) {
  const svg = React.useMemo(() => {
    try {
      // ECC "M" = 15% recovery, good balance for phone-camera scanning.
      const matrix = encodeQr(value, "M");
      return qrMatrixToSvg(matrix, { size, margin: 4, dark: "#000000", light: "#ffffff" });
    } catch {
      return null;
    }
  }, [value, size]);

  if (!svg) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        QR gagal dirender.<br />Gunakan tombol salin kode di bawah.
      </div>
    );
  }
  return (
    <span
      role="img"
      aria-label="Kode QRIS untuk dipindai"
      className="block"
      style={{ width: size, height: size }}
      // SVG is generated locally from trusted PG payload — safe to inline.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function QrisDialog({
  open, onOpenChange, state, qrString, qrUrl, secondsLeft, error, amount, label,
  provider, onCheckNow, checking = false, onRegenerate,
}: QrisDialogProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyString() {
    if (!qrString) return;
    try {
      await navigator.clipboard.writeText(qrString);
      setCopied(true);
    } catch {
      /* clipboard tidak tersedia — abaikan */
    }
  }

  const urgent = state === "pending" && secondsLeft > 0 && secondsLeft <= 60;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Bayar via QRIS
            </DrawerTitle>
            <div className="flex flex-col items-center gap-1">
              <p className="text-2xl font-extrabold tabular-nums text-primary">
                {fmtRupiah(amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {label ? `${label}` : "POS UMKM"}
                {provider ? ` · via ${provider.toUpperCase()}` : ""}
              </p>
            </div>
          </DrawerHeader>

          <div className="flex flex-col items-center gap-4 px-4 pb-2">
            {state === "creating" && (
              <div className="flex h-[232px] w-[232px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Membuat QR…
              </div>
            )}

            {state === "pending" && (
              <>
                <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  {qrString ? (
                    <QrCanvas value={qrString} size={232} />
                  ) : qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrUrl} alt="Kode QRIS" width={232} height={232} className="block" />
                  ) : (
                    <div className="flex h-[232px] w-[232px] items-center justify-center text-sm text-muted-foreground">
                      QR tidak tersedia
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    Pelanggan scan pakai GoPay / OVO / DANA / m-banking
                  </p>

                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
                      urgent ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", urgent ? "bg-destructive animate-pulse" : "bg-accent animate-pulse")} />
                    {fmtCountdown(secondsLeft)}
                  </div>

                  {/* Copy raw string fallback (for devices that scan from clipboard / sharing) */}
                  {qrString && (
                    <button
                      type="button"
                      onClick={copyString}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Kode QRIS tersalin" : "Salin kode QRIS"}
                    </button>
                  )}
                </div>
              </>
            )}

            {state === "expired" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-base font-semibold">QR kadaluarsa</p>
                <p className="text-sm text-muted-foreground">
                  Waktu pembayaran habis. Buat ulang QR untuk melanjutkan.
                </p>
                <Button onClick={onRegenerate}>
                  <RefreshCw className="h-4 w-4" /> Buat ulang QR
                </Button>
              </div>
            )}

            {state === "failed" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-base font-semibold text-destructive">Gagal membuat QR</p>
                <p className="text-sm text-muted-foreground">{error ?? "Terjadi kesalahan."}</p>
                <Button variant="outline" onClick={onRegenerate}>
                  <RefreshCw className="h-4 w-4" /> Coba lagi
                </Button>
              </div>
            )}

            {state === "paid" && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <p className="text-base font-semibold">Pembayaran berhasil</p>
                <p className="text-xs text-muted-foreground">Menyiapkan struk…</p>
              </div>
            )}
          </div>

          <DrawerFooter className="gap-2">
            {state === "pending" && onCheckNow && (
              <Button variant="outline" onClick={onCheckNow} disabled={checking}>
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Mengecek…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" /> Cek status pembayaran
                  </>
                )}
              </Button>
            )}
            <Button
              variant={state === "pending" ? "ghost" : "outline"}
              onClick={() => onOpenChange(false)}
            >
              {state === "pending" ? "Batalkan" : "Tutup"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
