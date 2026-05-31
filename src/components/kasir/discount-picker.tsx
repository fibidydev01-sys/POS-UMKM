"use client";

import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * DiscountPicker — pilih preset diskon (single-select) via shadcn ToggleGroup.
 * Berlaku V1 & V2. Tidak ada input bebas (by design).
 */
export function DiscountPicker({
  presets,
  selectedId,
  selectedPersen,
  onChange,
}: {
  presets: DiskonPreset[];
  selectedId: string | null;
  selectedPersen: number;
  onChange: (presetId: string | null, persen: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Diskon transaksi</span>
        <span className="text-sm font-bold text-primary">
          {selectedPersen > 0 ? `${selectedPersen}%` : "Tidak ada"}
        </span>
      </div>

      <ToggleGroup
        type="single"
        value={selectedId ?? "none"}
        onValueChange={(val) => {
          if (!val || val === "none") {
            onChange(null, 0);
            return;
          }
          const preset = presets.find((p) => p.id === val);
          if (preset) onChange(preset.id, preset.persen);
        }}
      >
        <ToggleGroupItem value="none" size="sm">
          Tidak ada
        </ToggleGroupItem>
        {presets.map((p) => (
          <ToggleGroupItem key={p.id} value={p.id} size="sm">
            {p.nama}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {presets.length === 0 && (
        <p className="py-1 text-xs text-muted-foreground">
          Belum ada preset. Tambah di Pengaturan → Preset Diskon.
        </p>
      )}
    </div>
  );
}
