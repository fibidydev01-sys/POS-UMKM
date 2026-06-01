"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, UtensilsCrossed, SlidersHorizontal } from "lucide-react";

import { useMenuManager } from "@/hooks/use-menu-manager";
import type { MenuItem, MenuItemInput } from "@/lib/db/menu";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { KategoriListWithManage } from "./kategori-list";
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
  const [initialView, setInitialView] = React.useState<"form" | "kelola">("form");
  const [deleteItem, setDeleteItem] = React.useState<MenuItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const katMap = React.useMemo(
    () => new Map(kategori.map((k) => [k.id, k.nama])),
    [kategori]
  );

  if (isLoading) return <PageSkeleton variant="list" />;

  const itemsTampil = katAktif
    ? items.filter((i) => i.kategori_id === katAktif)
    : items;

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

  async function handleHapusKat(id: string) {
    await hapusKat(id);
    if (katAktif === id) setKatAktif(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      {/* Header dengan tombol Kategori di pojok kanan atas */}
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kelola
          </p>
          <h1 className="text-xl font-extrabold">Menu &amp; Kategori</h1>
        </div>
        <button
          onClick={() => {
            setEditItem(null);
            setInitialView("kelola");
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Kategori
        </button>
      </header>

      {/* Chip filter kategori — tanpa tombol kelola */}
      <div className="mb-3">
        <KategoriListWithManage
          kategori={kategori}
          aktif={katAktif}
          onPilih={setKatAktif}
        />
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
          </EmptyMedia>
          <EmptyTitle>Belum ada produk</EmptyTitle>
          <EmptyDescription>Tambahkan produk pertama Anda.</EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itemsTampil.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              namaKategori={
                item.kategori_id ? katMap.get(item.kategori_id) : undefined
              }
              toggling={togglingId === item.id}
              onEdit={() => {
                setEditItem(item);
                setInitialView("form");
                setFormOpen(true);
              }}
              onToggle={(v) => handleToggle(item, v)}
            />
          ))}
        </div>
      )}

      {/* FAB Tambah Menu */}
      <button
        onClick={() => {
          setEditItem(null);
          setInitialView("form");
          setFormOpen(true);
        }}
        aria-label="Tambah menu"
        className="fixed bottom-[68px] left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform active:scale-[0.99] md:bottom-4 md:left-auto md:right-6 md:w-auto md:min-w-[220px] print:hidden"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          <span className="font-bold">Tambah Menu</span>
        </div>
        <span className="text-sm font-semibold opacity-80">
          {items.length} produk
        </span>
      </button>

      {/* Drawer — 1 drawer, 2 panel */}
      <FormMenuItem
        open={formOpen}
        onOpenChange={setFormOpen}
        kategori={kategori}
        item={editItem}
        initialView={initialView}
        onSimpan={handleSimpan}
        onHapus={editItem ? () => setDeleteItem(editItem) : undefined}
        onTambahKategori={tambahKat}
        onRenameKat={renameKat}
        onHapusKat={handleHapusKat}
      />

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