"use client";

// ⚠️ Komponen BARU. Import primitive UI di bawah mengikuti pola shadcn/ui yang umum
//    dipakai di proyek ini (Drawer seperti struk-dialog, Button). Kalau nama/َpath
//    primitive Anda beda, samakan import-nya — logika di dalam tidak perlu berubah.
import { QRCodeSVG } from "qrcode.react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
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

export function QrisDialog({
  open, onOpenChange, state, qrString, qrUrl, secondsLeft, error, amount, label, onRegenerate,
}: QrisDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Bayar via QRIS</DrawerTitle>
            <p className="text-sm text-muted-foreground">
              {label ? `${label} · ` : ""}{fmtRupiah(amount)}
            </p>
          </DrawerHeader>

          <div className="flex flex-col items-center gap-4 px-4 pb-2">
            {state === "creating" && (
              <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Membuat QR…
              </div>
            )}

            {state === "pending" && (
              <>
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  {qrString ? (
                    <QRCodeSVG value={qrString} size={232} level="M" includeMargin />
                  ) : qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrUrl} alt="QRIS" width={232} height={232} />
                  ) : (
                    <div className="flex h-58 w-58 items-center justify-center text-sm text-muted-foreground">
                      QR tidak tersedia
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Tunjukkan ke pelanggan untuk discan (GoPay / OVO / Dana / m-banking)
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {fmtCountdown(secondsLeft)}
                  </p>
                  <p className="text-xs text-muted-foreground">menunggu pembayaran…</p>
                </div>
              </>
            )}

            {state === "expired" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-base font-semibold">QR kadaluarsa</p>
                <p className="text-sm text-muted-foreground">
                  Waktu pembayaran habis. Buat ulang QR untuk melanjutkan.
                </p>
                <Button onClick={onRegenerate}>Buat ulang QR</Button>
              </div>
            )}

            {state === "failed" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-base font-semibold text-destructive">Gagal membuat QR</p>
                <p className="text-sm text-muted-foreground">{error ?? "Terjadi kesalahan."}</p>
                <Button variant="outline" onClick={onRegenerate}>Coba lagi</Button>
              </div>
            )}

            {state === "paid" && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
                  ✓
                </div>
                <p className="text-base font-semibold">Pembayaran berhasil</p>
              </div>
            )}
          </div>

          <DrawerFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {state === "pending" ? "Batalkan" : "Tutup"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
