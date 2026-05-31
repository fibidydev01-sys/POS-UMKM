"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/db/users";
import { getMenuTersedia, getKategori, type MenuItem, type Kategori } from "@/lib/db/menu";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { getDiskonPreset, type DiskonPreset } from "@/lib/db/diskon-preset";
import { getPromoAktif, type PromoRule } from "@/lib/db/promo-rule";
import { simpanTransaksi, type CartItem, type HasilTransaksi } from "@/lib/db/transaksi";
import { applyPromo, hitungGrandTotal } from "@/lib/cart/promo-engine";
import { parseRupiah, formatRupiah } from "@/lib/utils/currency";
import { features } from "@/lib/config/features";
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
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [menu, setMenu] = React.useState<MenuItem[]>([]);
  const [kategori, setKategori] = React.useState<Kategori[]>([]);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [presets, setPresets] = React.useState<DiskonPreset[]>([]);
  const [promoRules, setPromoRules] = React.useState<PromoRule[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [katAktif, setKatAktif] = React.useState<string | null>(null);
  const [cartRaw, setCartRaw] = React.useState<CartItem[]>([]);
  const [diskonPresetId, setDiskonPresetId] = React.useState<string | null>(null);
  const [diskonPersen, setDiskonPersen] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "qris" | "transfer" | "debit">("cash");
  const [uangDiterima, setUangDiterima] = React.useState("");
  const [keranjangOpen, setKeranjangOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [struk, setStruk] = React.useState<HasilTransaksi | null>(null);

  // V1: cart = cartRaw (promo engine tidak aktif).
  // V2: cart = cartRaw + promo_free items dari engine.
  const cart = React.useMemo(
    () => features.promoEngine ? applyPromo(cartRaw, promoRules) : cartRaw,
    [cartRaw, promoRules]
  );

  const { grandTotal } = hitungGrandTotal(cart, diskonPersen);
  const totalItem = cartRaw.reduce((s, c) => s + c.qty, 0);

  React.useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        if (!u) { router.replace("/aktivasi"); return; }
        setUser(u);

        const [m, k, c, p, pr] = await Promise.all([
          getMenuTersedia(u.umkm_id),
          getKategori(u.umkm_id),
          getConfig(u.umkm_id),
          // Preset diskon selalu dari DB — aktif di V1 dan V2
          getDiskonPreset(u.umkm_id),
          // Promo rule: hanya load di V2 (engine tidak aktif di V1)
          features.promoEngine
            ? getPromoAktif(u.umkm_id)
            : Promise.resolve([]),
        ]);
        setMenu(m as MenuItem[]);
        setKategori(k as Kategori[]);
        setConfig(c);
        setPresets(p as DiskonPreset[]);
        setPromoRules(pr as PromoRule[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const menuTampil = katAktif ? menu.filter((m) => m.kategori_id === katAktif) : menu;
  const qtyMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cartRaw) if (c.menu_item_id) map[c.menu_item_id] = c.qty;
    return map;
  }, [cartRaw]);

  function tambah(item: MenuItem) {
    setCartRaw((prev) => {
      const idx = prev.findIndex((c) => c.menu_item_id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, {
        menu_item_id: item.id,
        nama_produk: item.nama,
        harga_satuan: item.harga,
        qty: 1,
        diskon_preset_id: null,
        diskon_persen: 0,
      }];
    });
  }

  function ubahQty(menuItemId: string | null, delta: number) {
    setCartRaw((prev) =>
      prev.map((c) => c.menu_item_id === menuItemId ? { ...c, qty: c.qty + delta } : c)
        .filter((c) => c.qty > 0)
    );
  }

  function hapus(menuItemId: string | null) {
    setCartRaw((prev) => prev.filter((c) => c.menu_item_id !== menuItemId));
  }

  function handlePaymentChange(method: "cash" | "qris" | "transfer" | "debit") {
    setPaymentMethod(method);
    if (method !== "cash") setUangDiterima("");
  }

  async function bayar() {
    if (!user || cartRaw.length === 0 || saving) return;

    let method = paymentMethod;
    let uangFinal: number | null = null;

    if (features.payment) {
      const parsed = method === "cash" ? parseRupiah(uangDiterima) : null;
      if (method === "cash" && (parsed === null || parsed < grandTotal)) {
        alert("Uang diterima kurang dari total belanja.");
        return;
      }
      uangFinal = parsed;
    } else {
      // V1: catat langsung sebagai tunai, tanpa input uang.
      method = "cash";
    }

    setSaving(true);
    try {
      const hasil = await simpanTransaksi(
        user.umkm_id, user.id, cart,
        diskonPresetId, diskonPersen,
        method, uangFinal
      );
      setStruk(hasil);
      setKeranjangOpen(false);
      setCartRaw([]);
      setDiskonPresetId(null);
      setDiskonPersen(0);
      setPaymentMethod("cash");
      setUangDiterima("");
    } catch {
      alert("Gagal menyimpan transaksi. Cek koneksi internet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat kasir…</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kasir</p>
        <h1 className="text-xl font-extrabold">{config?.nama_umkm || "POS UMKM"}</h1>
      </header>

      {menu.length === 0 ? (
        <EmptyState icon="🍽️" judul="Belum ada menu" deskripsi="Tambahkan produk dulu di halaman Menu.">
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

      {totalItem > 0 && (
        <div className="fixed inset-x-0 bottom-[58px] z-30 px-4 print:hidden md:bottom-4 md:left-[72px] xl:left-[200px]">
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
        cartRaw={cartRaw}
        onUbahQty={ubahQty}
        onHapus={hapus}
        presets={presets}
        diskonPresetId={diskonPresetId}
        diskonPersen={diskonPersen}
        onDiskonChange={(id, p) => { setDiskonPresetId(id); setDiskonPersen(p); }}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={handlePaymentChange}
        uangDiterima={uangDiterima}
        onUangDiterimaChange={setUangDiterima}
        onBayar={bayar}
        saving={saving}
      />

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
          <Button variant="outline" className="flex-1" onClick={() => setStruk(null)}>Transaksi Baru</Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak Struk
          </Button>
        </div>
      </Dialog>
    </main>
  );
}