"use client";

import * as React from "react";
import type { Kategori, MenuItem, MenuItemInput } from "@/lib/db/menu";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatAngka, parseRupiah } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

export default function FormMenuItem({
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
  onHapus?: () => Promise<void> | void;
}) {
  const [nama, setNama] = React.useState("");
  const [harga, setHarga] = React.useState("");
  const [kategoriId, setKategoriId] = React.useState<string | null>(null);
  const [tersedia, setTersedia] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setNama(item?.nama ?? "");
      setHarga(item ? formatAngka(item.harga) : "");
      setKategoriId(item?.kategori_id ?? null);
      setTersedia(item?.tersedia ?? true);
    }
  }, [open, item]);

  const valid = nama.trim().length > 0 && parseRupiah(harga) > 0;

  async function simpan() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSimpan({ nama, harga: parseRupiah(harga), kategori_id: kategoriId, tersedia });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{item ? "Edit Menu" : "Tambah Menu"}</DialogTitle>
      </DialogHeader>

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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
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

        {kategori.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Kategori</Label>
            <div className="flex flex-wrap gap-2">
              <KatChip label="Tanpa kategori" active={kategoriId === null} onClick={() => setKategoriId(null)} />
              {kategori.map((k) => (
                <KatChip key={k.id} label={k.nama} active={kategoriId === k.id} onClick={() => setKategoriId(k.id)} />
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setTersedia((v) => !v)}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
        >
          <span className="text-sm font-semibold">Tersedia dijual</span>
          <span className={cn("relative h-6 w-11 rounded-full transition-colors", tersedia ? "bg-accent" : "bg-border")}>
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                tersedia ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
        {item && onHapus ? (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={async () => {
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

function KatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}
