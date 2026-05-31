"use client";

import * as React from "react";
import type { Kategori, MenuItem, MenuItemInput } from "@/lib/db/menu";
import { FormDrawer } from "@/components/shared/form-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronRight, Tag, Check, SlidersHorizontal } from "lucide-react";
import { formatAngka, parseRupiah } from "@/lib/utils/currency";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function FormMenuItem({
  open,
  onOpenChange,
  kategori,
  item,
  onSimpan,
  onHapus,
  onKelola,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategori: Kategori[];
  item: MenuItem | null;
  onSimpan: (input: MenuItemInput) => Promise<void> | void;
  onHapus?: () => void;
  onTambahKategori?: (nama: string) => Promise<void>;
  onKelola?: () => void;
}) {
  const [nama, setNama] = React.useState("");
  const [harga, setHarga] = React.useState("");
  const [kategoriId, setKategoriId] = React.useState<string | null>(null);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [katPickerOpen, setKatPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setNama(item?.nama ?? "");
      setHarga(item ? formatAngka(item.harga) : "");
      setKategoriId(item?.kategori_id ?? null);
      setIsAvailable(item?.is_available ?? true);
    }
  }, [open, item]);

  const valid = nama.trim().length > 0 && parseRupiah(harga) > 0;
  const namaKategoriTerpilih =
    kategori.find((k) => k.id === kategoriId)?.nama ?? "Tanpa kategori";

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
    <>
      {/* Drawer 1: Form Menu */}
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={item ? "Edit Menu" : "Tambah Menu"}
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

          <div className="flex flex-col gap-1.5">
            <Label>Kategori</Label>
            <button
              type="button"
              onClick={() => setKatPickerOpen(true)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
                kategoriId ? "border-accent/30 bg-accent/10" : "border-border bg-secondary/40 hover:bg-secondary/70"
              )}
            >
              <div className="flex items-center gap-2">
                <Tag className={cn("h-4 w-4", kategoriId ? "text-accent" : "text-muted-foreground")} />
                <span className={cn("text-sm font-semibold", kategoriId ? "text-accent" : "text-muted-foreground")}>
                  {namaKategoriTerpilih}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <div>
              <span className="text-sm font-semibold">Tersedia dijual hari ini</span>
              <p className="text-xs text-muted-foreground">Bisa di-toggle kapan saja jika stok habis</p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} aria-label="Tersedia hari ini" />
          </div>

          {item && onHapus && (
            <Button
              variant="ghost"
              className="mt-1 w-full justify-center text-destructive hover:bg-destructive/10"
              onClick={() => { onOpenChange(false); onHapus(); }}
            >
              <Trash2 className="h-4 w-4" /> Hapus menu ini
            </Button>
          )}
        </div>
      </FormDrawer>

      {/* Drawer 2: Pilih Kategori */}
      <Drawer open={katPickerOpen} onOpenChange={setKatPickerOpen}>
        <DrawerContent className="mx-auto flex max-h-[88dvh] flex-col sm:max-w-lg">
          {/* DrawerTitle hidden untuk aksesibilitas */}
          <DrawerHeader className="hidden">
            <DrawerTitle>Pilih Kategori</DrawerTitle>
          </DrawerHeader>

          {/* Header visible: tombol Kategori saja */}
          <div className="flex items-center justify-end px-4 pb-2 pt-4">
            {onKelola && (
              <button
                type="button"
                onClick={() => { setKatPickerOpen(false); onKelola(); }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Kategori
              </button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 px-3 pb-4">
              <KatRow
                label="Tanpa kategori"
                active={kategoriId === null}
                onClick={() => { setKategoriId(null); setKatPickerOpen(false); }}
              />
              {kategori.map((k) => (
                <KatRow
                  key={k.id}
                  label={k.nama}
                  active={kategoriId === k.id}
                  onClick={() => { setKategoriId(k.id); setKatPickerOpen(false); }}
                />
              ))}
              {kategori.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Belum ada kategori. Tap <strong>Kategori</strong> di atas untuk menambah.
                </p>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function KatRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors",
        active ? "bg-accent/10 text-accent" : "hover:bg-secondary"
      )}
    >
      {label}
      {active && <Check className="h-4 w-4" />}
    </button>
  );
}