"use client";

import * as React from "react";
import type { PromoRule, PromoRuleInput } from "@/lib/db/promo-rule";
import type { MenuItem } from "@/lib/db/menu";
import { FormDrawer } from "@/components/shared/form-drawer";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPE_OPTIONS = [
  { value: "bogo", label: "Beli 1 Gratis 1", desc: "Setiap beli 1, dapat 1 gratis" },
  { value: "buy2get1", label: "Beli 2 Gratis 1", desc: "Setiap beli 2, dapat 1 gratis" },
] as const;

export function FormPromoRule({
  open,
  onOpenChange,
  promo,
  menuItems,
  onSimpan,
  onHapus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: PromoRule | null;
  menuItems: MenuItem[];
  onSimpan: (input: PromoRuleInput) => Promise<void>;
  onHapus?: () => void;
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
      setBerlakuMulai(
        promo?.berlaku_mulai
          ? promo.berlaku_mulai.slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setBerlakuSampai(promo?.berlaku_sampai ? promo.berlaku_sampai.slice(0, 10) : "");
    }
  }, [open, promo]);

  const valid =
    menuItemId !== "" &&
    berlakuMulai !== "" &&
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
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={promo ? "Edit Promo" : "Tambah Promo"}
      onSimpan={simpan}
      saving={saving}
      canSave={valid}
    >
      <div className="flex flex-col gap-4">
        {!promo && (
          <div className="flex flex-col gap-1.5">
            <Label>Item yang dapat promo</Label>
            <Select value={menuItemId} onValueChange={setMenuItemId}>
              <SelectTrigger>
                <SelectValue placeholder="-- Pilih item --" />
              </SelectTrigger>
              <SelectContent>
                {menuItems.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
                    tipePromo === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                      tipePromo === t.value ? "border-primary bg-primary" : "border-border"
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mulai">Mulai berlaku</Label>
            <input
              id="mulai"
              type="date"
              value={berlakuMulai}
              onChange={(e) => setBerlakuMulai(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
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
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Kosongkan tanggal berakhir jika promo tidak ada batas waktu.
        </p>

        {promo && onHapus && (
          <Button
            variant="ghost"
            className="mt-1 w-full justify-center text-destructive hover:bg-destructive/10"
            onClick={() => {
              onOpenChange(false);
              onHapus();
            }}
          >
            <Trash2 className="h-4 w-4" /> Hapus promo ini
          </Button>
        )}
      </div>
    </FormDrawer>
  );
}
