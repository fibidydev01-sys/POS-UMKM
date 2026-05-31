"use client";

import * as React from "react";

import { useRiwayat } from "@/hooks/use-riwayat";
import type { Transaksi } from "@/lib/db/transaksi";
import { formatTanggalPanjang, jakartaDateStr } from "@/lib/utils/date";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { TransaksiRow } from "./transaksi-row";
import { TransaksiDetailDialog } from "./transaksi-detail";

export function RiwayatView() {
  const { list, config, isLoading, fetchItems, doVoid, doRefund } = useRiwayat();
  const [selected, setSelected] = React.useState<Transaksi | null>(null);

  if (isLoading) return <PageSkeleton variant="list" />;

  let lastDate = "";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Catatan
        </p>
        <h1 className="text-xl font-extrabold">Riwayat Transaksi</h1>
      </header>

      {list.length === 0 ? (
        <Empty>
          <EmptyMedia>🧾</EmptyMedia>
          <EmptyTitle>Belum ada transaksi</EmptyTitle>
          <EmptyDescription>Transaksi yang dibuat akan muncul di sini.</EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-1">
          {list.map((t) => {
            const ds = jakartaDateStr(t.created_at);
            const showHeader = ds !== lastDate;
            lastDate = ds;
            return (
              <React.Fragment key={t.id}>
                {showHeader && (
                  <p className="mb-1 mt-3 px-1 text-xs font-bold text-muted-foreground">
                    {formatTanggalPanjang(t.created_at)}
                  </p>
                )}
                <TransaksiRow trx={t} onClick={() => setSelected(t)} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      <TransaksiDetailDialog
        trx={selected}
        config={config}
        fetchItems={fetchItems}
        onClose={() => setSelected(null)}
        onVoid={doVoid}
        onRefund={doRefund}
      />
    </main>
  );
}
