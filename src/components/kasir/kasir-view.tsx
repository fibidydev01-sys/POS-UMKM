"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

import { useKasirData, useCart, useBayar } from "@/hooks/use-kasir-data";
import { useCartStore } from "@/store/cart-store";
import type { MenuItem } from "@/lib/db/menu";
import type { HasilTransaksi } from "@/lib/db/transaksi";
import { features } from "@/lib/config/features";
import { usePaymentSession } from "@/hooks/use-payment-session";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { MenuGrid } from "./menu-grid";
import type { MenuLayout } from "./menu-card";
import { LayoutToggle } from "./layout-toggle";
import { KategoriList } from "@/components/menu/kategori-list";
import { CartPanel } from "./cart-panel";
import { StrukDialog } from "./struk-dialog";
import { QrisDialog } from "./qris-dialog";
import { formatRupiah } from "@/lib/utils/currency";

export function KasirView() {
  const router = useRouter();
  const { data, isLoading, pgReady } = useKasirData();

  const [katAktif, setKatAktif] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<MenuLayout>("list");
  const [keranjangOpen, setKeranjangOpen] = React.useState(false);
  const [struk, setStruk] = React.useState<HasilTransaksi | null>(null);

  // cart store
  const items = useCartStore((s) => s.items);
  const tambah = useCartStore((s) => s.tambah);
  const ubahQty = useCartStore((s) => s.ubahQty);
  const resetCart = useCartStore((s) => s.reset);
  const diskonPresetId = useCartStore((s) => s.diskonPresetId);
  const diskonPersen = useCartStore((s) => s.diskonPersen);
  const setDiskon = useCartStore((s) => s.setDiskon);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const uangDiterima = useCartStore((s) => s.uangDiterima);
  const setUangDiterima = useCartStore((s) => s.setUangDiterima);

  const promoRules = data?.promoRules ?? [];
  const { cart, grandTotal } = useCart(promoRules);
  const { bayar, saving } = useBayar(cart, grandTotal);

  // V3 — sesi QRIS (hanya dipakai bila build v3 & PG aktif).
  const pay = usePaymentSession();
  const [qrisOpen, setQrisOpen] = React.useState(false);

  const totalItem = items.reduce((s, c) => s + c.qty, 0);

  const qtyMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of items) if (c.menu_item_id) map[c.menu_item_id] = c.qty;
    return map;
  }, [items]);

  // QRIS sukses (dikonfirmasi webhook → polling) → tampil struk, reset, seperti cash.
  const payReset = pay.reset;
  React.useEffect(() => {
    if (pay.state === "paid" && pay.struk) {
      setStruk(pay.struk);
      setQrisOpen(false);
      setKeranjangOpen(false);
      resetCart();
      toast.success(`Transaksi #${pay.struk.trx.nomor_order} tersimpan`);
      payReset();
    }
  }, [pay.state, pay.struk, resetCart, payReset]);

  if (isLoading || !data) return <PageSkeleton variant="kasir" />;

  const { menu, kategori, config, presets } = data;
  const menuTampil = katAktif ? menu.filter((m) => m.kategori_id === katAktif) : menu;

  const handleTambah = (item: MenuItem) =>
    tambah({ id: item.id, nama: item.nama, harga: item.harga });

  async function handleBayar() {
    // R1 — jalur QRIS-via-PG: buat QR otomatis, transaksi dibuat di webhook (R8).
    if (features.qrisPayment && paymentMethod === "qris") {
      if (!pgReady) {
        // Build v3 tapi belum ada gateway aktif → jangan diam-diam catat manual.
        toast.error("Gateway QRIS belum terhubung. Hubungkan dulu di Pengaturan → Pembayaran.");
        return;
      }
      setQrisOpen(true);
      await pay.create({
        cart,
        diskonPresetId,
        diskonPersen,
        label: config?.nama_umkm || "POS UMKM",
      });
      return;
    }
    // Jalur lama (cash / manual) — tidak berubah.
    const res = await bayar();
    if (res.ok && res.struk) {
      setStruk(res.struk);
      setKeranjangOpen(false);
      toast.success(`Transaksi #${res.struk.trx.nomor_order} tersimpan`);
    } else if (res.error) {
      toast.error(res.error);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kasir
          </p>
          <h1 className="text-xl font-extrabold">{config?.nama_umkm || "POS UMKM"}</h1>
        </div>
        {menu.length > 0 && <LayoutToggle value={layout} onChange={setLayout} />}
      </header>

      {menu.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
          </EmptyMedia>
          <EmptyTitle>Belum ada menu</EmptyTitle>
          <EmptyDescription>Tambahkan produk dulu di halaman Menu.</EmptyDescription>
          <EmptyContent>
            <Button onClick={() => router.push("/menu")}>Kelola Menu</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {kategori.length > 0 && (
            <div className="mb-3">
              <KategoriList kategori={kategori} aktif={katAktif} onPilih={setKatAktif} />
            </div>
          )}
          <MenuGrid
            items={menuTampil}
            qtyMap={qtyMap}
            layout={layout}
            onTambah={handleTambah}
          />
        </>
      )}

      {/* Tombol keranjang — bar aksesibel persegi panjang rounded di atas nav */}
      {totalItem > 0 && (
        <button
          onClick={() => setKeranjangOpen(true)}
          aria-label={`Buka keranjang, ${totalItem} item`}
          className="fixed bottom-[68px] left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform active:scale-[0.99] md:bottom-4 md:left-auto md:right-6 md:w-auto md:min-w-[220px] print:hidden"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-bold">{totalItem} item</span>
          </div>
          <span className="font-extrabold">{formatRupiah(grandTotal)}</span>
        </button>
      )}

      <CartPanel
        open={keranjangOpen}
        onOpenChange={setKeranjangOpen}
        cart={cart}
        cartRaw={items}
        onUbahQty={ubahQty}
        presets={presets}
        diskonPresetId={diskonPresetId}
        diskonPersen={diskonPersen}
        onDiskonChange={setDiskon}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        uangDiterima={uangDiterima}
        onUangDiterimaChange={setUangDiterima}
        onBayar={handleBayar}
        saving={saving || pay.state === "creating"}
        qrisPgReady={pgReady}
        onSetupGateway={() => router.push("/pengaturan/pembayaran")}
      />

      <StrukDialog struk={struk} config={config} onClose={() => setStruk(null)} />

      <QrisDialog
        open={qrisOpen}
        onOpenChange={(o) => {
          setQrisOpen(o);
          if (!o) pay.reset();
        }}
        state={pay.state}
        qrString={pay.qrString}
        qrUrl={pay.qrUrl}
        provider={pay.provider}
        secondsLeft={pay.secondsLeft}
        error={pay.error}
        amount={grandTotal}
        label={config?.nama_umkm || undefined}
        checking={pay.checking}
        onCheckNow={pay.checkNow}
        onRegenerate={pay.regenerate}
      />
    </main>
  );
}
