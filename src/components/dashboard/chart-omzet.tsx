"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { OmzetHari } from "@/lib/db/omzet-banding";
import { formatRupiah } from "@/lib/utils/currency";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const HARI_PENUH = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface ChartRow { label: string; tanggal: string; ini: number; lalu: number; }

export default function ChartOmzet({ data, dataLalu }: { data: OmzetHari[]; dataLalu: OmzetHari[]; }) {
  const rows = React.useMemo<ChartRow[]>(() => data.map((d, i) => ({ label: d.label, tanggal: d.tanggal, ini: d.total, lalu: dataLalu[i]?.total ?? 0 })), [data, dataLalu]);
  const totalIni = data.reduce((s, d) => s + d.total, 0);
  const totalLalu = dataLalu.reduce((s, d) => s + d.total, 0);
  const naik = totalLalu === 0 ? (totalIni > 0 ? 100 : 0) : Math.round(((totalIni - totalLalu) / totalLalu) * 100);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Omzet 7 Hari</p>
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", naik >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          <TrendingUp className={cn("h-3 w-3", naik < 0 && "rotate-180")} />{Math.abs(naik)}%
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{formatRupiah(totalIni)}</p>
      <p className="text-xs text-muted-foreground">Minggu lalu: {formatRupiah(totalLalu)}</p>
      <div className="mt-4 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <Tooltip cursor={{ fill: "var(--secondary)" }} content={<OmzetTooltip />} />
            <Bar dataKey="lalu" radius={[3, 3, 0, 0]} maxBarSize={10}>{rows.map((_, i) => (<Cell key={i} fill="var(--border)" />))}</Bar>
            <Bar dataKey="ini" radius={[3, 3, 0, 0]} maxBarSize={10}>{rows.map((_, i) => (<Cell key={i} fill="var(--primary)" />))}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex justify-center gap-5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Minggu ini</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-border" /> Minggu lalu</span>
      </div>
    </Card>
  );
}

interface TooltipPayload { payload: ChartRow; }
function OmzetTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[]; }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const date = new Date(`${row.tanggal}T12:00:00`);
  const valid = !isNaN(date.getTime());
  const namaHari = valid ? HARI_PENUH[date.getDay()] : row.label;
  const tgl = valid ? `${date.getDate()}/${date.getMonth() + 1}` : "";
  return (
    <div className="rounded-lg bg-foreground px-3 py-2 text-left shadow-lg">
      <p className="mb-1 text-[10px] font-bold text-background/60">{tgl ? `${namaHari} · ${tgl}` : namaHari}</p>
      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /><span className="flex-1 text-[11px] text-background/85">Minggu ini</span><span className="text-xs font-bold text-background">{formatRupiah(row.ini)}</span></div>
      <div className="mt-0.5 flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-background/40" /><span className="flex-1 text-[11px] text-background/85">Minggu lalu</span><span className="text-xs font-bold text-background">{formatRupiah(row.lalu)}</span></div>
    </div>
  );
}
