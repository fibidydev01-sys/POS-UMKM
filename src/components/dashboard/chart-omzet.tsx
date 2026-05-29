"use client";

import type { OmzetHarian } from "@/lib/db/transaksi";
import { formatAngka } from "@/lib/utils/currency";

export default function ChartOmzet({ data }: { data: OmzetHarian[] }) {
  const max = Math.max(1, ...data.map((d) => d.omzet));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-bold">Omzet 7 Hari Terakhir</p>
      <div className="flex h-40 items-end justify-between gap-2">
        {data.map((d) => {
          const tinggi = Math.round((d.omzet / max) * 100);
          return (
            <div key={d.tanggal} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">
                {d.omzet > 0 ? formatAngka(Math.round(d.omzet / 1000)) + "k" : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-primary/85 transition-all"
                  style={{ height: `${Math.max(tinggi, d.omzet > 0 ? 6 : 2)}%` }}
                  title={formatAngka(d.omzet)}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
