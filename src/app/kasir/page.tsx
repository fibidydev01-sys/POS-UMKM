"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId } from "@/lib/utils/umkm-id";
import { getMenuTersedia, getKategori, type MenuItem, type Kategori } from "@/lib/db/menu";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { simpanTransaksi, type CartItem, type HasilTransaksi } from "@/lib/db/transaksi";
import { formatRupiah } from "@/lib/utils/currency";
import MenuGrid from "@/components/kasir/menu-grid";
import KeranjangPanel from "@/components/kasir/keranjang-panel";
import StrukPrint from "@/components/kasir/struk-print";
import KategoriList from "@/components/menu/kategori-list";
import EmptyState from "@/components/shared/empty-state";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, CheckCircle2, Printer } from "lucide-react";

export default function KasirPage() {
  const router = useRouter();
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState<MenuItem[]>([]);
  const [kategori, setKategori] = React.useState<Kategori[]>([]);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [katAktif, setKatAktif] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [diskonPersen, setDiskonPersen] = React.useState(0);
  const [catatan, setCatatan] = React.useState("");
  const [keranjangOpen, setKeranjangOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [struk, setStruk] = React.useState<HasilTransaksi | null>(null);

  React.useEffect(() => {
    const id = getUmkmId();
    if (!id) {
      router.replace("/aktivasi");
      return;
    }
    setUmkmId(id);
    (async () => {
      try {
        const [m, k, c] = await Promise.all([getMenuTersedia(id), getKategori(id), getConfig(id)]);
        setMenu(m);
        setKategori(k);
        setConfig(c);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const menuTampil = katAktif ? menu.filter((m) => m.kategori_id === katAktif) : menu;
  const qtyMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cart) if (c.menu_item_id) map[c.menu_item_id] = c.qty;
    return map;
  }, [cart]);

  const subtotal = cart.reduce((s, c) => s + c.harga_satuan * c.qty, 0);
  const grandTotal = subtotal - Math.round((subtotal * diskonPersen) / 100);
  const totalItem = cart.reduce((s, c) => s + c.qty, 0);

  function tambah(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menu_item_id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        { menu_item_id: item.id, nama_produk: item.nama, harga_satuan: item.harga, qty: 1, diskon_persen: 0 },
      ];
    });
  }

  function ubahQty(menuItemId: string | null, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.menu_item_id === menuItemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  function hapus(menuItemId: string | null) {
    setCart((prev) => prev.filter((c) => c.menu_item_id !== menuItemId));
  }

  async function bayar() {
    if (!umkmId || cart.length === 0 || saving) return;
    setSaving(true);
    try {
      const hasil = await simpanTransaksi(umkmId, cart, diskonPersen, catatan);
      setStruk(hasil);
      setKeranjangOpen(false);
      setCart([]);
      setDiskonPersen(0);
      setCatatan("");
    } catch {
      alert("Gagal menyimpan transaksi. Cek koneksi internet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CenterInfo>Memuat kasir…</CenterInfo>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kasir</p>
        <h1 className="text-xl font-extrabold">{config?.nama_umkm || "POS UMKM"}</h1>
      </header>

      {menu.length === 0 ? (
        <EmptyState
          icon="🍽️"
          judul="Belum ada menu"
          deskripsi="Tambahkan produk dulu di halaman Menu untuk mulai berjualan."
        >
          <Button onClick={() => router.push("/menu")}>Kelola Menu</Button>
        </EmptyState>
      ) : (
        <>
          {kategori.length > 0 && (
            <div className="mb-3">
              <KategoriList kategori={kategori} aktif={katAktif} onPilih={setKatAktif} />
            </div>
          )}
          <MenuGrid items={menuTampil} qtyMap={qtyMap} onTambah={tambah} />
        </>
      )}

      {/* Bar keranjang mengambang */}
      {totalItem > 0 && (
        <div className="fixed inset-x-0 bottom-[58px] z-30 px-4 print:hidden">
          <button
            onClick={() => setKeranjangOpen(true)}
            className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
                <ShoppingCart className="h-4 w-4" />
              </span>
              {totalItem} item
            </span>
            <span className="text-lg font-extrabold">{formatRupiah(grandTotal)}</span>
          </button>
        </div>
      )}

      <KeranjangPanel
        open={keranjangOpen}
        onOpenChange={setKeranjangOpen}
        cart={cart}
        onUbahQty={ubahQty}
        onHapus={hapus}
        diskonPersen={diskonPersen}
        onDiskonChange={setDiskonPersen}
        catatan={catatan}
        onCatatanChange={setCatatan}
        onBayar={bayar}
        saving={saving}
      />

      {/* Struk hasil transaksi */}
      <Dialog open={!!struk} onOpenChange={(o) => !o && setStruk(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Transaksi #{struk?.trx.nomor_order} berhasil
          </DialogTitle>
        </DialogHeader>

        {struk && (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-2">
            <StrukPrint config={config} trx={struk.trx} items={struk.items} />
          </div>
        )}

        <div className="mt-5 flex gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={() => setStruk(null)}>
            Transaksi Baru
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak Struk
          </Button>
        </div>
      </Dialog>
    </main>
  );
}

function CenterInfo({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{children}</div>;
}
