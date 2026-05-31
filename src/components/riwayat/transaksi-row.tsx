"use client";

import type { Transaksi } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";
import { formatJam } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  completed: "Selesai",
  void: "VOID",
  refund: "REFUND",
};

type BadgeVariant = "success" | "destructive" | "warning";
export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  completed: "success",
  void: "destructive",
  refund: "warning",
};

export function TransaksiRow({ trx, onClick }: { trx: Transaksi; onClick: () => void }) {
  const isVoidOrRefund = trx.status !== "completed";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/40",
        isVoidOrRefund && "opacity-60"
      )}
    >
      <div className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold",
        isVoidOrRefund ? "bg-muted text-muted-foreground" : "bg-secondary"
      )}>
        #{trx.nomor_order.split("-")[1] ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("font-bold", isVoidOrRefund && "text-muted-foreground line-through")}>
            {formatRupiah(trx.grand_total)}
          </p>
          {isVoidOrRefund && (
            <Badge variant={STATUS_VARIANT[trx.status]}>{STATUS_LABEL[trx.status]}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatJam(trx.created_at)} · {trx.payment_method === "cash" ? "Tunai" : trx.payment_method.toUpperCase()}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
