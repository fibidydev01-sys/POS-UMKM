"use client";

import * as React from "react";
import type { Kategori } from "@/lib/db/menu";
import { Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * CategoryBadge — pil ala Instagram yang menggantikan tombol X di header
 * FormDrawer menu. Menampilkan kategori terpilih; tap → buka picker kategori
 * (drawer kecil), pilih → langsung set. Hemat ruang, satu sentuhan.
 */
export function CategoryBadge({
  kategori,
  value,
  onChange,
}: {
  kategori: Kategori[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const aktif = value ? kategori.find((k) => k.id === value) : null;
  const label = aktif?.nama ?? "Tanpa kategori";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex max-w-[55%] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
          aktif
            ? "border-accent/30 bg-accent/10 text-accent"
            : "border-border bg-secondary text-muted-foreground"
        )}
      >
        <Tag className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto flex max-h-[70dvh] flex-col sm:max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Pilih Kategori</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 px-3 pb-4">
              <CategoryRow
                label="Tanpa kategori"
                active={value === null}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
              {kategori.map((k) => (
                <CategoryRow
                  key={k.id}
                  label={k.nama}
                  active={value === k.id}
                  onClick={() => {
                    onChange(k.id);
                    setOpen(false);
                  }}
                />
              ))}
              {kategori.length === 0 && (
                <p className="px-1 py-3 text-center text-sm text-muted-foreground">
                  Belum ada kategori. Tambah lewat tombol Kategori di halaman Menu.
                </p>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function CategoryRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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
