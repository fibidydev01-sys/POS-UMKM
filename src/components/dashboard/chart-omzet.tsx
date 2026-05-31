"use client";

import * as React from "react";
import type { OmzetHari } from "@/lib/db/omzet-banding";
import { formatRupiah } from "@/lib/utils/currency";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChartOmzet — grafik batang omzet 7 hari: minggu ini vs minggu lalu.
 * Mengetuk sebuah kolom menampilkan tooltip gelap berisi tanggal + nilai
 * "minggu ini" & "minggu lalu". Ketuk lagi untuk menutup.
 *
 * Murni Tailwind/inline-style (tanpa lib chart) — ringan & tanpa dependency.
 */
export default function ChartOmzet({
  data,
  dataLalu,
}: {
  data: OmzetHari[];
  dataLalu: OmzetHari[];
}) {
  const [aktif, setAktif] = React.useState<number | null>(null);

  const semua = [...data, ...dataLalu].map((d) => d.total);
  const maks = Math.max(1, ...semua);
  const totalIni = data.reduce((s, d) => s + d.total, 0);
  const totalLalu = dataLalu.reduce((s, d) => s + d.total, 0);
  const naik =
    totalLalu === 0 ? (totalIni > 0 ? 100 : 0) : Math.round(((totalIni - totalLalu) / totalLalu) * 100);

  const titik = aktif !== null ? data[aktif] : null;
  const titikLalu = aktif !== null ? dataLalu[aktif] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Omzet 7 Hari</p>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
            naik >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          <TrendingUp className={cn("h-3 w-3", naik < 0 && "rotate-180")} />
          {Math.abs(naik)}%
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{formatRupiah(totalIni)}</p>
      <p className="text-xs text-muted-foreground">Minggu lalu: {formatRupiah(totalLalu)}</p>

      <div className="relative mt-6">
        <div className="flex h-32 items-end justify-between gap-1.5">
          {data.map((d, i) => {
            const lalu = dataLalu[i]?.total ?? 0;
            const tIni = Math.round((d.total / maks) * 100);
            const tLalu = Math.round((lalu / maks) * 100);
            const isAktif = aktif === i;
            const align = i <= 1 ? "left-0" : i >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
            const caretPos = i <= 1 ? "left-4" : i >= 5 ? "right-4" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={d.tanggal}
                type="button"
                onClick={() => setAktif((p) => (p === i ? null : i))}
                className="relative flex flex-1 flex-col items-center gap-1"
              >
                {isAktif && titik && (
                  <div
                    className={cn(
                      "absolute bottom-full z-20 mb-2 w-[150px] rounded-lg bg-[#1c140e] px-3 py-2 text-left shadow-lg",
                      align
                    )}
                  >
                    <p className="mb-1 text-[10px] font-bold text-white/60">{labelTanggal(titik)}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-primary" />
                      <span className="flex-1 text-[11px] text-white/85">Minggu ini</span>
                      <span className="text-xs font-bold text-white">{formatRupiah(titik.total)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-[#9a8e82]" />
                      <span className="flex-1 text-[11px] text-white/85">Minggu lalu</span>
                      <span className="text-xs font-bold text-white">
                        {formatRupiah(titikLalu?.total ?? 0)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "absolute -bottom-1 h-3 w-3 rotate-45 rounded-sm bg-[#1c140e]",
                        caretPos
                      )}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "flex h-[100px] w-full items-end justify-center gap-0.5 rounded px-0.5",
                    isAktif && "bg-primary/10"
                  )}
                >
                  <div
                    className="w-[9px] rounded-sm bg-[#d2c5b8]"
                    style={{ height: `${Math.max(tLalu, 2)}%` }}
                  />
                  <div
                    className="w-[9px] rounded-sm bg-primary"
                    style={{ height: `${Math.max(tIni, 2)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isAktif ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Minggu ini
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d2c5b8]" /> Minggu lalu
        </span>
      </div>
    </div>
  );
}

const HARI_PENUH = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Sabtu · 30/5" — hari penuh + tanggal/bulan tanpa nol depan. */
function labelTanggal(d: OmzetHari): string {
  const date = new Date(`${d.tanggal}T12:00:00`);
  const valid = !isNaN(date.getTime());
  const namaHari = valid ? HARI_PENUH[date.getDay()] : d.label;
  const tgl = valid ? `${date.getDate()}/${date.getMonth() + 1}` : "";
  return tgl ? `${namaHari} · ${tgl}` : namaHari;
}
