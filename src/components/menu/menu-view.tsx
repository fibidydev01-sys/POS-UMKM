"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Tags, Trash2, Pencil } from "lucide-react";

import { useMenuManager } from "@/hooks/use-menu-manager";
import type { MenuItem, Kategori, MenuItemInput } from "@/lib/db/menu";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { KategoriList } from "./kategori-list";
import { MenuItemCard } from "./menu-item-card";
import { FormMenuItem } from "./form-menu-item";

export function MenuView() {
  const {
    items,
    kategori,
    isLoading,
    simpanItem,
    hapusItem,
    onToggle,
    tambahKat,
    hapusKat,
    renameKat,
  } = useMenuManager();

  const [katAktif, setKatAktif] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<MenuItem | null>(null);
  const [katOpen, setKatOpen] = React.useState(false);
  const [katBaru, setKatBaru] = React.useState("");
  const [deleteItem, setDeleteItem] = React.useState<MenuItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const katMap = React.useMemo(
    () => new Map(kategori.map((k) => [k.id, k.nama])),
    [kategori]
  );

  if (isLoading) return <PageSkeleton variant="list" />;

  const itemsTampil = katAktif ? items.filter((i) => i.kategori_id === katAktif) : items;

  async function handleSimpan(input: MenuItemInput) {
    await simpanItem(input, editItem?.id);
    toast.success(editItem ? "Menu diperbarui" : "Menu ditambahkan");
  }

  async function handleToggle(item: MenuItem, val: boolean) {
    setTogglingId(item.id);
    try {
      await onToggle(item, val);
    } catch {
      toast.error("Gagal mengubah ketersediaan");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await hapusItem(deleteItem.id);
      toast.success(`"${deleteItem.nama}" dihapus`);
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTambahKat() {
    if (!katBaru.trim()) return;
    await tambahKat(katBaru);
    setKatBaru("");
    toast.success("Kategori ditambahkan");
  }

  async function handleHapusKat(id: string) {
    await hapusKat(id);
    if (katAktif === id) setKatAktif(null);
  }

  async function handleRenameKat(k: Kategori) {
    const nama = window.prompt("Ubah nama kategori", k.nama);
    if (nama && nama.trim()) {
      await renameKat(k.id, nama);
      toast.success("Kategori diperbarui");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kelola
          </p>
          <h1 className="text-xl font-extrabold">Menu &amp; Kategori</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setKatOpen(true)}>
          <Tags className="h-4 w-4" /> Kategori
        </Button>
      </header>

      {kategori.length > 0 && (
        <div className="mb-3">
          <KategoriList kategori={kategori} aktif={katAktif} onPilih={setKatAktif} />
        </div>
      )}

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia>🍜</EmptyMedia>
          <EmptyTitle>Belum ada produk</EmptyTitle>
          <EmptyDescription>Tambahkan produk pertama Anda.</EmptyDescription>
          <EmptyContent>
            <Button
              onClick={() => {
                setEditItem(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Tambah Menu
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itemsTampil.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              namaKategori={item.kategori_id ? katMap.get(item.kategori_id) : undefined}
              toggling={togglingId === item.id}
              onEdit={() => {
                setEditItem(item);
                setFormOpen(true);
              }}
              onToggle={(v) => handleToggle(item, v)}
            />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <Button
          size="icon"
          className="fixed bottom-[72px] right-4 z-30 h-14 w-14 rounded-full shadow-lg md:bottom-6"
          onClick={() => {
            setEditItem(null);
            setFormOpen(true);
          }}
          aria-label="Tambah menu"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <FormMenuItem
        open={formOpen}
        onOpenChange={setFormOpen}
        kategori={kategori}
        item={editItem}
        onSimpan={handleSimpan}
        onHapus={editItem ? () => setDeleteItem(editItem) : undefined}
      />

      <Drawer open={katOpen} onOpenChange={setKatOpen}>
        <DrawerContent className="mx-auto flex max-h-[80dvh] flex-col sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Kelola Kategori</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <div className="flex gap-2">
              <Input
                value={katBaru}
                onChange={(e) => setKatBaru(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTambahKat()}
                placeholder="Nama kategori baru"
              />
              <Button onClick={handleTambahKat} disabled={!katBaru.trim()}>
                Tambah
              </Button>
            </div>
          </div>
          <ScrollArea className="mt-2 flex-1">
            <div className="flex flex-col gap-2 px-4 pb-4">
              {kategori.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Belum ada kategori.
                </p>
              ) : (
                kategori.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex-1 font-semibold">{k.nama}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => handleRenameKat(k)}
                      aria-label="Ubah nama"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleHapusKat(k.id)}
                      aria-label="Hapus kategori"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title={deleteItem ? `Hapus "${deleteItem.nama}"?` : ""}
        description="Item tidak akan muncul di kasir, tapi riwayat transaksinya tetap tersimpan."
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </main>
  );
}
