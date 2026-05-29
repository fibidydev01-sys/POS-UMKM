"use client";

import type { TopProduk, AnalisaDiskon } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";

export function TopProdukList({ data }: { data: TopProduk[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-bold">Produk Terlaris (bulan ini)</p>
      {data.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Belum ada penjualan.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((p, i) => (
            <li key={p.nama_produk} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {i + 1}
              </span>
              <span className="flex-1 truncate font-semibold">{p.nama_produk}</span>
              <span className="text-sm text-muted-foreground">{p.total_terjual}x</span>
              <span className="w-24 text-right text-sm font-bold">{formatRupiah(p.total_omzet)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalisaDiskonList({ data }: { data: AnalisaDiskon[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-sm font-bold">Analisa Diskon (bulan ini)</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Preset diskon yang paling banyak dipakai dan total nilai yang diberikan.
      </p>
      {data.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Belum ada diskon tercatat.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((d) => (
            <li key={d.nama_preset} className="flex items-center gap-3">
              <span className="flex-1 truncate font-semibold">{d.nama_preset}</span>
              <span className="text-xs text-muted-foreground">{d.kali_dipakai}x</span>
              <span className="w-24 text-right text-sm font-bold text-destructive">
                -{formatRupiah(d.total_nilai_diskon)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
