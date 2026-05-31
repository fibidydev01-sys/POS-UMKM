"use client";

import type { TopProduk, AnalisaDiskon } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";
import { Flame, Tag } from "lucide-react";

export function TopProdukList({ data }: { data: TopProduk[] }) {
  const maks = Math.max(1, ...data.map((d) => d.total_terjual));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">Produk Terlaris</p>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Bulan ini</p>
      {data.length === 0 ? (
        <p className="py-3 text-sm italic text-muted-foreground">Belum ada penjualan bulan ini.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((p, i) => (
            <li key={p.nama_produk} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-sm font-extrabold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nama_produk}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((p.total_terjual / maks) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold tabular-nums">{p.total_terjual}x</p>
                <p className="text-xs text-muted-foreground">{formatRupiah(p.total_omzet)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalisaDiskonList({ data }: { data: AnalisaDiskon[] }) {
  if (data.length === 0) return null;
  const totalSemua = data.reduce((s, d) => s + d.total_nilai_diskon, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-accent" />
        <p className="text-sm font-bold">Analisa Diskon</p>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Total diberikan bulan ini: {formatRupiah(totalSemua)}
      </p>
      <ul className="flex flex-col">
        {data.map((d) => (
          <li
            key={d.nama_preset}
            className="flex items-center gap-3 border-t border-border py-2 first:border-t-0 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.nama_preset}</p>
              <p className="text-xs text-muted-foreground">
                {d.persen != null ? `${d.persen}% · ` : ""}
                {d.kali_dipakai}x dipakai
              </p>
            </div>
            <span className="text-sm font-extrabold text-accent">
              {formatRupiah(d.total_nilai_diskon)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
