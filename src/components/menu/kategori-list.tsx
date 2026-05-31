"use client";

import type { Kategori } from "@/lib/db/menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * KategoriList — filter kategori horizontal-scroll memakai ToggleGroup.
 * "Semua" diwakili value "all".
 */
export function KategoriList({
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
    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        type="single"
        value={aktif ?? "all"}
        onValueChange={(val) => onPilih(!val || val === "all" ? null : val)}
        className="w-max flex-nowrap"
      >
        {tampilkanSemua && (
          <ToggleGroupItem value="all" className="shrink-0 rounded-full px-4">
            Semua
          </ToggleGroupItem>
        )}
        {kategori.map((k) => (
          <ToggleGroupItem key={k.id} value={k.id} className="shrink-0 rounded-full px-4">
            {k.nama}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
