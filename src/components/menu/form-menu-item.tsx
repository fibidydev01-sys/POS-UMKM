"use client";

import * as React from "react";
import type { Kategori, MenuItem, MenuItemInput } from "@/lib/db/menu";
import { FormDrawer } from "@/components/shared/form-drawer";
import { CategoryBadge } from "./category-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatAngka, parseRupiah } from "@/lib/utils/currency";

export function FormMenuItem({
  open,
  onOpenChange,
  kategori,
  item,
  onSimpan,
  onHapus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategori: Kategori[];
  item: MenuItem | null;
  onSimpan: (input: MenuItemInput) => Promise<void> | void;
  onHapus?: () => void;
}) {
  const [nama, setNama] = React.useState("");
  const [harga, setHarga] = React.useState("");
  const [kategoriId, setKategoriId] = React.useState<string | null>(null);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setNama(item?.nama ?? "");
      setHarga(item ? formatAngka(item.harga) : "");
      setKategoriId(item?.kategori_id ?? null);
      setIsAvailable(item?.is_available ?? true);
    }
  }, [open, item]);

  const valid = nama.trim().length > 0 && parseRupiah(harga) > 0;

  async function simpan() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSimpan({
        nama,
        harga: parseRupiah(harga),
        kategori_id: kategoriId,
        is_available: isAvailable,
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
      title={item ? "Edit Menu" : "Tambah Menu"}
      headerRight={
        <CategoryBadge kategori={kategori} value={kategoriId} onChange={setKategoriId} />
      }
      onSimpan={simpan}
      saving={saving}
      canSave={valid}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nama">Nama produk</Label>
          <Input
            id="nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth. Kopi Tubruk"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="harga">Harga</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              Rp
            </span>
            <Input
              id="harga"
              inputMode="numeric"
              value={harga}
              onChange={(e) => setHarga(formatAngka(parseRupiah(e.target.value)))}
              placeholder="0"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <span className="text-sm font-semibold">Tersedia dijual hari ini</span>
            <p className="text-xs text-muted-foreground">
              Bisa di-toggle kapan saja jika stok habis
            </p>
          </div>
          <Switch
            checked={isAvailable}
            onCheckedChange={setIsAvailable}
            aria-label="Tersedia hari ini"
          />
        </div>

        {item && onHapus && (
          <Button
            variant="ghost"
            className="mt-1 w-full justify-center text-destructive hover:bg-destructive/10"
            onClick={() => {
              onOpenChange(false);
              onHapus();
            }}
          >
            <Trash2 className="h-4 w-4" /> Hapus menu ini
          </Button>
        )}
      </div>
    </FormDrawer>
  );
}
