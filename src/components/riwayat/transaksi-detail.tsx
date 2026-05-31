"use client";

import * as React from "react";
import { toast } from "sonner";
import { Printer, XCircle, RotateCcw } from "lucide-react";

import type { UmkmConfig } from "@/lib/db/config";
import type { Transaksi, TransactionItem } from "@/lib/db/transaksi";
import { features } from "@/lib/config/features";
import { cn } from "@/lib/utils";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StrukPrint } from "@/components/kasir/struk-print";
import { STATUS_LABEL, STATUS_VARIANT } from "./transaksi-row";

export function TransaksiDetailDialog({
  trx,
  config,
  fetchItems,
  onClose,
  onVoid,
  onRefund,
}: {
  trx: Transaksi | null;
  config: UmkmConfig | null;
  fetchItems: (id: string) => Promise<TransactionItem[]>;
  onClose: () => void;
  onVoid: (id: string) => Promise<void>;
  onRefund: (id: string, alasan: string) => Promise<void>;
}) {
  const [items, setItems] = React.useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [showRefundForm, setShowRefundForm] = React.useState(false);
  const [alasanRefund, setAlasanRefund] = React.useState("");
  const [refundLoading, setRefundLoading] = React.useState(false);
  const [voidConfirm, setVoidConfirm] = React.useState(false);
  const [voidLoading, setVoidLoading] = React.useState(false);

  React.useEffect(() => {
    if (!trx) return;
    setShowRefundForm(false);
    setAlasanRefund("");
    setLoadingItems(true);
    fetchItems(trx.id)
      .then(setItems)
      .finally(() => setLoadingItems(false));
  }, [trx, fetchItems]);

  async function handleVoid() {
    if (!trx) return;
    setVoidLoading(true);
    try {
      await onVoid(trx.id);
      toast.success(`Transaksi #${trx.nomor_order} di-void`);
      setVoidConfirm(false);
      onClose();
    } catch {
      toast.error("Gagal void transaksi");
    } finally {
      setVoidLoading(false);
    }
  }

  async function handleRefund() {
    if (!trx || !alasanRefund.trim()) return;
    setRefundLoading(true);
    try {
      await onRefund(trx.id, alasanRefund.trim());
      toast.success(`Transaksi #${trx.nomor_order} di-refund`);
      onClose();
    } catch {
      toast.error("Gagal refund transaksi");
    } finally {
      setRefundLoading(false);
    }
  }

  const isCompleted = trx?.status === "completed";

  return (
    <>
      <Drawer open={!!trx} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="mx-auto flex max-h-[90dvh] flex-col sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              Detail #{trx?.nomor_order}
              {trx && trx.status !== "completed" && (
                <Badge variant={STATUS_VARIANT[trx.status]}>{STATUS_LABEL[trx.status]}</Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3 px-4 py-2">
              {loadingItems ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : (
                trx && (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-2">
                    <StrukPrint config={config} trx={trx} items={items} />
                  </div>
                )
              )}

              {trx?.void_reason && (
                <p
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs",
                    trx.status === "refund"
                      ? "bg-warning/10 text-warning"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {trx.status === "refund" ? "Alasan refund" : "Alasan void"}: {trx.void_reason}
                </p>
              )}

              {features.refund && showRefundForm && isCompleted && (
                <div className="flex flex-col gap-2 print:hidden">
                  <p className="text-sm font-semibold">Alasan refund (wajib)</p>
                  <Input
                    value={alasanRefund}
                    onChange={(e) => setAlasanRefund(e.target.value)}
                    placeholder="cth. Pelanggan komplain, salah item"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowRefundForm(false)}
                    >
                      Batal
                    </Button>
                    <Button
                      className="flex-1 bg-warning text-white hover:bg-warning/90"
                      disabled={!alasanRefund.trim() || refundLoading}
                      onClick={handleRefund}
                    >
                      {refundLoading ? "Memproses…" : "Konfirmasi Refund"}
                    </Button>
                  </div>
                </div>
              )}

              {!showRefundForm && isCompleted && (
                <div className="flex gap-2 print:hidden">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setVoidConfirm(true)}
                  >
                    <XCircle className="h-4 w-4" /> Void
                  </Button>
                  {features.refund && (
                    <Button
                      variant="ghost"
                      className="text-warning hover:bg-warning/10"
                      onClick={() => setShowRefundForm(true)}
                    >
                      <RotateCcw className="h-4 w-4" /> Refund
                    </Button>
                  )}
                  <Button className="flex-1" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Cetak Ulang
                  </Button>
                </div>
              )}

              {!showRefundForm && !isCompleted && (
                <Button className="w-full print:hidden" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Cetak Ulang
                </Button>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={voidConfirm}
        onOpenChange={(o) => !o && setVoidConfirm(false)}
        title={trx ? `Void transaksi #${trx.nomor_order}?` : ""}
        description="Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Void"
        destructive
        loading={voidLoading}
        onConfirm={handleVoid}
      />
    </>
  );
}
