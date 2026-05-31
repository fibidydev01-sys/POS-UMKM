"use client";

import * as React from "react";
import type { DiskonPreset, DiskonPresetInput } from "@/lib/db/diskon-preset";
import { FormDrawer } from "@/components/shared/form-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function FormDiskonPreset({
  open,
  onOpenChange,
  preset,
  onSimpan,
  onHapus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: DiskonPreset | null;
  onSimpan: (input: DiskonPresetInput) => Promise<void> | void;
  onHapus?: () => void;
}) {
  const [nama, setNama] = React.useState("");
  const [persen, setPersen] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setNama(preset?.nama ?? "");
      setPersen(preset ? String(preset.persen) : "");
    }
  }, [open, preset]);

  const persenNum = parseFloat(persen.replace(",", ".") || "0");
  const valid = nama.trim().length > 0 && !isNaN(persenNum) && persenNum > 0 && persenNum < 100;

  async function simpan() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSimpan({ nama: nama.trim(), persen: persenNum });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={preset ? "Edit Preset Diskon" : "Tambah Preset Diskon"}
      onSimpan={simpan}
      saving={saving}
      canSave={valid}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nama-preset">Nama preset</Label>
          <Input
            id="nama-preset"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth. Diskon Member, Happy Hour"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="persen-preset">Persentase diskon</Label>
          <div className="relative">
            <Input
              id="persen-preset"
              inputMode="decimal"
              value={persen}
              onChange={(e) => setPersen(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="10"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Mendukung desimal, contoh: 12.5 untuk 12,5%
          </p>
        </div>

        {preset && onHapus && (
          <Button
            variant="ghost"
            className="mt-1 w-full justify-center text-destructive hover:bg-destructive/10"
            onClick={() => {
              onOpenChange(false);
              onHapus();
            }}
          >
            <Trash2 className="h-4 w-4" /> Hapus preset ini
          </Button>
        )}
      </div>
    </FormDrawer>
  );
}
