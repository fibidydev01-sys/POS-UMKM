"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId } from "@/lib/utils/umkm-id";
import {
  getMenuItems, getKategori, tambahMenuItem, updateMenuItem, hapusMenuItem, toggleTersedia,
  tambahKategori, hapusKategori, updateKategori,
  type MenuItem, type Kategori, type MenuItemInput,
} from "@/lib/db/menu";
import KategoriList from "@/components/menu/kategori-list";
import MenuItemCard from "@/components/menu/menu-item-card";
import FormMenuItem from "@/components/menu/form-menu-item";
import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Tags, Trash2, Pencil } from "lucide-react";

export default function MenuPage() {
  const router = useRouter();
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MenuItem[]>([]);
  const [kategori, setKategori] = React.useState<Kategori[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [katAktif, setKatAktif] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<MenuItem | null>(null);
  const [katOpen, setKatOpen] = React.useState(false);
  const [katBaru, setKatBaru] = React.useState("");

  const reload = React.useCallback(async (id: string) => {
    const [m, k] = await Promise.all([getMenuItems(id), getKategori(id)]);
    setItems(m);
    setKategori(k);
  }, []);

  React.useEffect(() => {
    const id = getUmkmId();
    if (!id) {
      router.replace("/aktivasi");
      return;
    }
    setUmkmId(id);
    reload(id).finally(() => setLoading(false));
  }, [router, reload]);

  const katMap = React.useMemo(() => new Map(kategori.map((k) => [k.id, k.nama])), [kategori]);
  const itemsTampil = katAktif ? items.filter((i) => i.kategori_id === katAktif) : items;

  async function simpanItem(input: MenuItemInput) {
    if (!umkmId) return;
    if (editItem) await updateMenuItem(editItem.id, input);
    else await tambahMenuItem(umkmId, input);
    await reload(umkmId);
  }

  async function hapusItem() {
    if (!umkmId || !editItem) return;
    await hapusMenuItem(editItem.id);
    await reload(umkmId);
  }

  async function onToggle(item: MenuItem, tersedia: boolean) {
    if (!umkmId) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, tersedia } : i))); // optimistik
    await toggleTersedia(item.id, tersedia);
  }

  async function tambahKat() {
    if (!umkmId || !katBaru.trim()) return;
    await tambahKategori(umkmId, katBaru);
    setKatBaru("");
    await reload(umkmId);
  }

  async function hapusKat(id: string) {
    if (!umkmId) return;
    await hapusKategori(id);
    if (katAktif === id) setKatAktif(null);
    await reload(umkmId);
  }

  async function renameKat(k: Kategori) {
    if (!umkmId) return;
    const nama = window.prompt("Ubah nama kategori", k.nama);
    if (nama && nama.trim()) {
      await updateKategori(k.id, nama);
      await reload(umkmId);
    }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat menu…</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kelola</p>
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
        <EmptyState icon="🍜" judul="Belum ada produk" deskripsi="Tambahkan produk pertama Anda.">
          <Button
            onClick={() => {
              setEditItem(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tambah Menu
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itemsTampil.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              namaKategori={item.kategori_id ? katMap.get(item.kategori_id) : undefined}
              onEdit={() => {
                setEditItem(item);
                setFormOpen(true);
              }}
              onToggle={(t) => onToggle(item, t)}
            />
          ))}
        </div>
      )}

      {/* FAB tambah */}
      {items.length > 0 && (
        <button
          onClick={() => {
            setEditItem(null);
            setFormOpen(true);
          }}
          className="fixed bottom-[72px] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          aria-label="Tambah menu"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <FormMenuItem
        open={formOpen}
        onOpenChange={setFormOpen}
        kategori={kategori}
        item={editItem}
        onSimpan={simpanItem}
        onHapus={editItem ? hapusItem : undefined}
      />

      {/* Kelola kategori */}
      <Dialog open={katOpen} onOpenChange={setKatOpen}>
        <DialogHeader>
          <DialogTitle>Kelola Kategori</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={katBaru}
            onChange={(e) => setKatBaru(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tambahKat()}
            placeholder="Nama kategori baru"
          />
          <Button onClick={tambahKat} disabled={!katBaru.trim()}>
            Tambah
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {kategori.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Belum ada kategori.</p>
          ) : (
            kategori.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex-1 font-semibold">{k.nama}</span>
                <button
                  onClick={() => renameKat(k)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  aria-label="Ubah nama"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => hapusKat(k.id)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  aria-label="Hapus kategori"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </Dialog>
    </main>
  );
}
