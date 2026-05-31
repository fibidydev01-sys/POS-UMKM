"use client";

import * as React from "react";
import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { ChevronRight, Tag, Check, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils/currency";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * DiscountPicker — pilih preset diskon via Drawer (lebih clean dari ToggleGroup inline).
 * Tap chip diskon → buka Drawer → pilih → tutup otomatis.
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
  const [open, setOpen] = React.useState(false);
  const selected = presets.find((p) => p.id === selectedId) ?? null;

  function pilih(preset: DiskonPreset | null) {
    if (preset) onChange(preset.id, preset.persen);
    else onChange(null, 0);
    setOpen(false);
  }

  return (
    <>
      {/* Trigger chip */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
          selected
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-secondary/40 hover:bg-secondary/70"
        )}
      >
        <div className="flex items-center gap-2">
          <Tag className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-muted-foreground")}>
            {selected ? selected.nama : "Tidak ada diskon"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {selected && (
            <span className="text-sm font-bold text-primary">{selected.persen}%</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {/* Drawer picker */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto flex max-h-[70dvh] flex-col sm:max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Pilih Diskon</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 px-3 pb-4">
              {/* Tidak ada diskon */}
              <DiskonRow
                label="Tidak ada diskon"
                active={selectedId === null}
                onClick={() => pilih(null)}
              />
              {presets.map((p) => (
                <DiskonRow
                  key={p.id}
                  label={p.nama}
                  persen={p.persen}
                  active={selectedId === p.id}
                  onClick={() => pilih(p)}
                />
              ))}
              {presets.length === 0 && (
                <p className="px-1 py-3 text-center text-sm text-muted-foreground">
                  Belum ada preset. Tambah di Pengaturan.
                </p>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function DiskonRow({
  label,
  persen,
  active,
  onClick,
}: {
  label: string;
  persen?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-xl px-3 py-3 text-left transition-colors",
        active ? "bg-primary/10 text-primary" : "hover:bg-secondary"
      )}
    >
      <div className="flex items-center gap-3">
        {persen != null && (
          <div className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold",
            active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {persen}%
          </div>
        )}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {active && <Check className="h-4 w-4" />}
    </button>
  );
}
