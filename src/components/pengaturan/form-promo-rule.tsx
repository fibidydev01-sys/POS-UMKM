"use client";

import * as React from "react";
import type { PromoRule, PromoRuleInput } from "@/lib/db/promo-rule";
import type { MenuItem } from "@/lib/db/menu";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIPE_OPTIONS = [
  { value: "bogo", label: "Beli 1 Gratis 1", desc: "Setiap beli 1, dapat 1 gratis" },
  { value: "buy2get1", label: "Beli 2 Gratis 1", desc: "Setiap beli 2, dapat 1 gratis" },
] as const;

export default function FormPromoRule({
  open, onOpenChange, promo, menuItems, onSimpan, onHapus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: PromoRule | null;
  menuItems: MenuItem[];
  onSimpan: (input: PromoRuleInput) => Promise<void>;
  onHapus?: () => Promise<void>;
}) {
  const [menuItemId, setMenuItemId] = React.useState("");
  const [tipePromo, setTipePromo] = React.useState<"bogo" | "buy2get1">("bogo");
  const [berlakuMulai, setBerlakuMulai] = React.useState("");
  const [berlakuSampai, setBerlakuSampai] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMenuItemId(promo?.menu_item_id ?? "");
      setTipePromo(promo?.tipe_promo ?? "bogo");
      setBerlakuMulai(promo?.berlaku_mulai ? promo.berlaku_mulai.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setBerlakuSampai(promo?.berlaku_sampai ? promo.berlaku_sampai.slice(0, 10) : "");
    }
  }, [open, promo]);

  const valid = menuItemId !== "" && berlakuMulai !== "" &&
    (!berlakuSampai || berlakuSampai > berlakuMulai);

  async function simpan() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSimpan({
        menu_item_id: menuItemId,
        tipe_promo: tipePromo,
        berlaku_mulai: new Date(berlakuMulai).toISOString(),
        berlaku_sampai: berlakuSampai ? new Date(berlakuSampai).toISOString() : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{promo ? "Edit Promo" : "Tambah Promo"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {/* Pilih item */}
        {!promo && (
          <div className="flex flex-col gap-1.5">
            <Label>Item yang dapat promo</Label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-- Pilih item --</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tipe promo */}
        {!promo && (
          <div className="flex flex-col gap-1.5">
            <Label>Tipe promo</Label>
            <div className="flex flex-col gap-2">
              {TIPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipePromo(t.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    tipePromo === t.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                    tipePromo === t.value ? "border-primary bg-primary" : "border-border"
                  )} />
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Periode */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mulai">Mulai berlaku</Label>
            <input
              id="mulai"
              type="date"
              value={berlakuMulai}
              onChange={(e) => setBerlakuMulai(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sampai">Berakhir (opsional)</Label>
            <input
              id="sampai"
              type="date"
              value={berlakuSampai}
              min={berlakuMulai}
              onChange={(e) => setBerlakuSampai(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Kosongkan tanggal berakhir jika promo tidak ada batas waktu.
        </p>
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
        {promo && onHapus ? (
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!window.confirm("Hapus promo ini?")) return;
              await onHapus();
              onOpenChange(false);
            }}>
            Hapus
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={simpan} disabled={!valid || saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
