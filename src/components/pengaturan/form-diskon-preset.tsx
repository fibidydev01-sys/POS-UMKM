"use client";

import * as React from "react";
import type { DiskonPreset, DiskonPresetInput } from "@/lib/db/diskon-preset";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function FormDiskonPreset({
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
  onHapus?: () => Promise<void> | void;
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
  const valid =
    nama.trim().length > 0 &&
    !isNaN(persenNum) &&
    persenNum > 0 &&
    persenNum < 100;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{preset ? "Edit Preset Diskon" : "Tambah Preset Diskon"}</DialogTitle>
      </DialogHeader>

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
              onChange={(e) => {
                // Hanya angka dan titik/koma
                const v = e.target.value.replace(/[^0-9.,]/g, "");
                setPersen(v);
              }}
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
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
        {preset && onHapus ? (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!window.confirm(`Hapus preset "${preset.nama}"?`)) return;
              await onHapus();
              onOpenChange(false);
            }}
          >
            Hapus
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={simpan} disabled={!valid || saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
