"use client";

import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { features } from "@/lib/config/features";
import { cn } from "@/lib/utils";

/**
 * Diskon selector.
 *
 * V1 mode (NEXT_PUBLIC_POS_VERSION=v1):
 *   Tampilkan hardcoded [5, 10, 15, 20]%.
 *   preset_id dikirim null — kolom nullable di DB, sudah difix di schema 3.1.
 *   Tidak ada input nominal bebas.
 *
 * Final mode (NEXT_PUBLIC_POS_VERSION=final):
 *   Load dari tabel diskon_preset — di-pass dari kasir/page.tsx.
 *   Tidak ada input nominal bebas.
 */

const V1_PRESETS = [5, 10, 15, 20];

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
  const header = (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-muted-foreground">Diskon transaksi</span>
      <span className="text-sm font-bold text-primary">
        {selectedPersen > 0 ? `${selectedPersen}%` : "Tidak ada"}
      </span>
    </div>
  );

  // ── V1 mode: hardcoded presets ────────────────────────────
  if (!features.diskonDariDB) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onChange(null, 0)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
              selectedPersen === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-secondary"
            )}
          >
            Tidak ada
          </button>
          {V1_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onChange(null, p)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                selectedPersen === p && selectedId === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-secondary"
              )}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Final mode: load dari DB ──────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      {header}
      <div className="flex flex-wrap gap-2">
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
            Belum ada preset. Tambah di Pengaturan → Diskon.
          </p>
        )}
      </div>
    </div>
  );
}
