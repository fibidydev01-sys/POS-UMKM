"use client";

import type { Kategori } from "@/lib/db/menu";
import { SlidersHorizontal } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Komponen lama — dipakai di halaman Kasir (tanpa tombol kelola). */
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

/**
 * KategoriListWithManage — versi halaman Menu.
 * Chip filter kategori scrollable + tombol ikon Kelola di ujung kanan (sticky).
 * Tombol tidak ikut scroll — selalu visible.
 */
export function KategoriListWithManage({
  kategori,
  aktif,
  onPilih,
  onKelola,
}: {
  kategori: Kategori[];
  aktif: string | null;
  onPilih: (id: string | null) => void;
  onKelola: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Area chip scrollable */}
      <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ToggleGroup
          type="single"
          value={aktif ?? "all"}
          onValueChange={(val) => onPilih(!val || val === "all" ? null : val)}
          className="w-max flex-nowrap"
        >
          <ToggleGroupItem value="all" className="shrink-0 rounded-full px-4">
            Semua
          </ToggleGroupItem>
          {kategori.map((k) => (
            <ToggleGroupItem key={k.id} value={k.id} className="shrink-0 rounded-full px-4">
              {k.nama}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Tombol Kelola Kategori — sticky di kanan, tidak ikut scroll */}
      <button
        type="button"
        onClick={onKelola}
        aria-label="Kelola kategori"
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5",
          "text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Kategori
      </button>
    </div>
  );
}