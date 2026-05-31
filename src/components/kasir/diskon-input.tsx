"use client";

import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { cn } from "@/lib/utils";

/**
 * Diskon selector — load dari tabel diskon_preset (DB).
 *
 * Berlaku untuk V1 dan V2. Preset dikelola owner dari halaman
 * Pengaturan → Preset Diskon. Default 4 preset di-seed saat aktivasi.
 *
 * Tidak ada input nominal bebas — by design di kedua versi.
 * Preset di-load oleh parent (kasir/page.tsx) dan di-pass sebagai props.
 */
export default function DiskonInput({
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

      <div className="flex flex-wrap gap-2">
        {/* Tidak ada diskon */}
        <button
          onClick={() => onChange(null, 0)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
            selectedId === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-secondary"
          )}
        >
          Tidak ada
        </button>

        {/* Preset dari DB */}
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id, p.persen)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
              selectedId === p.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-secondary"
            )}
          >
            {p.nama}
          </button>
        ))}

        {presets.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">
            Belum ada preset. Tambah di Pengaturan → Preset Diskon.
          </p>
        )}
      </div>
    </div>
  );
}
