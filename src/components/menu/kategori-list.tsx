"use client";

import type { Kategori } from "@/lib/db/menu";
import { cn } from "@/lib/utils";

export default function KategoriList({
  kategori,
  aktif,
  onPilih,
  tampilkanSemua = true,
}: {
  kategori: Kategori[];
  aktif: string | null;
  onPilih: (id: string | null) => void;
  tampilkanSemua?: boolean;
}) {
  if (kategori.length === 0 && tampilkanSemua) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tampilkanSemua && (
        <Chip label="Semua" active={aktif === null} onClick={() => onPilih(null)} />
      )}
      {kategori.map((k) => (
        <Chip key={k.id} label={k.nama} active={aktif === k.id} onClick={() => onPilih(k.id)} />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}
