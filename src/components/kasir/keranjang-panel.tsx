"use client";

/**
 * KeranjangPanel
 *
 * MOBILE  (< 768px / portrait)  → Drawer (vaul) — swipe-up dari bawah,
 *                                  feel native seperti bottom sheet iOS/Android.
 * TABLET  (≥ 768px / landscape) → Sheet (shadcn) — slide dari bawah layar,
 *                                  max-w-2xl centered, lebih lapang.
 *
 * Strategi deteksi: custom hook useIsTablet() pakai window.matchMedia
 * (768px selaras dengan breakpoint md Tailwind).
 * SSR-safe: default ke false (mobile), rehydrate setelah mount.
 */

import * as React from "react";
import { Drawer } from "vaul";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import DiskonInput from "./diskon-input";
import type { CartItem } from "@/lib/db/transaksi";
import type { DiskonPreset } from "@/lib/db/diskon-preset";
import { formatRupiah, parseRupiah, formatAngka } from "@/lib/utils/currency";
import { hitungGrandTotal } from "@/lib/cart/promo-engine";
import { features } from "@/lib/config/features";
import { Minus, Plus, Trash2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Konstanta ──────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: "💵 Tunai",
  qris: "📱 QRIS",
  transfer: "🏦 Transfer",
  debit: "💳 Debit",
};

const PAYMENT_METHODS = ["cash", "qris", "transfer", "debit"] as const;

// Extended CartItem — field dari promo engine
interface ExtendedCartItem extends CartItem {
  item_type?: "normal" | "discounted" | "promo_free";
}

// ── Hook deteksi tablet ────────────────────────────────────────────────

function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsTablet(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isTablet;
}

// ── Props ──────────────────────────────────────────────────────────────

interface KeranjangPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cartRaw: CartItem[];
  onUbahQty: (menuItemId: string | null, delta: number) => void;
  onHapus: (menuItemId: string | null) => void;
  presets: DiskonPreset[];
  diskonPresetId: string | null;
  diskonPersen: number;
  onDiskonChange: (presetId: string | null, persen: number) => void;
  paymentMethod: "cash" | "qris" | "transfer" | "debit";
  onPaymentMethodChange: (method: "cash" | "qris" | "transfer" | "debit") => void;
  uangDiterima: string;
  onUangDiterimaChange: (v: string) => void;
  onBayar: () => void;
  saving: boolean;
}

// ── Komponen utama ─────────────────────────────────────────────────────

export default function KeranjangPanel(props: KeranjangPanelProps) {
  const isTablet = useIsTablet();

  return isTablet
    ? <KeranjangSheet {...props} />
    : <KeranjangDrawer {...props} />;
}

// ── Isi panel (shared antara Drawer dan Sheet) ─────────────────────────

function PanelContent({
  cart,
  cartRaw,
  onUbahQty,
  onHapus,
  presets,
  diskonPresetId,
  diskonPersen,
  onDiskonChange,
  paymentMethod,
  onPaymentMethodChange,
  uangDiterima,
  onUangDiterimaChange,
  onBayar,
  saving,
  isDrawer = false,
}: KeranjangPanelProps & { isDrawer?: boolean }) {
  const showPayment = features.payment;
  const { subtotal, diskonNominal, grandTotal } = hitungGrandTotal(cart, diskonPersen);
  const uangNum = parseRupiah(uangDiterima);
  const isCash = showPayment && paymentMethod === "cash";
  const kembalian = isCash && uangNum >= grandTotal ? uangNum - grandTotal : null;

  const canBayar =
    cart.length > 0 &&
    !saving &&
    grandTotal > 0 &&
    (!showPayment || paymentMethod !== "cash" || uangNum >= grandTotal);

  const promoFreeItems = (cart as ExtendedCartItem[]).filter(
    (c) => c.item_type === "promo_free"
  );
  const totalQtyRaw = cartRaw.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="flex h-full flex-col">
      {/* ── Handle drag (drawer mobile only) ── */}
      {/* Drawer.Handle vaul: punya hitarea besar & touch-action pan-y yang benar */}
      {isDrawer && (
        <Drawer.Handle className="mx-auto mb-1 mt-3 h-1.5 w-12 rounded-full bg-border" />
      )}

      {/* ── Header ── */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-bold">Keranjang</h2>
        <p className="text-sm text-muted-foreground">{totalQtyRaw} item</p>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Item pilihan kasir (cartRaw) */}
        {cartRaw.map((c) => (
          <div
            key={c.menu_item_id ?? c.nama_produk}
            className="flex items-center gap-3 py-2.5"
          >
            <div className="flex-1">
              <p className="font-semibold leading-tight">{c.nama_produk}</p>
              <p className="text-sm text-muted-foreground">
                {formatRupiah(c.harga_satuan)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUbahQty(c.menu_item_id, -1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                aria-label="Kurangi"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">
                {c.qty}
              </span>
              <button
                onClick={() => onUbahQty(c.menu_item_id, 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                aria-label="Tambah"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="w-24 text-right font-bold">
              {formatRupiah(c.harga_satuan * c.qty)}
            </div>
            <button
              onClick={() => onHapus(c.menu_item_id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
              aria-label="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Item gratis dari promo — read-only */}
        {promoFreeItems.map((c, i) => (
          <div
            key={`promo-${i}`}
            className="flex items-center gap-3 py-1.5 opacity-80"
          >
            <Gift className="h-4 w-4 shrink-0 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight text-accent">
                {c.nama_produk}
              </p>
              <p className="text-xs text-accent/70">GRATIS (BOGO)</p>
            </div>
            <div className="text-sm font-bold text-accent">Rp 0</div>
          </div>
        ))}

        <Separator className="my-3" />

        {/* Diskon */}
        <DiskonInput
          presets={presets}
          selectedId={diskonPresetId}
          selectedPersen={diskonPersen}
          onChange={onDiskonChange}
        />

        {/* Metode bayar — hanya V2 */}
        {showPayment && (
          <>
            <Separator className="my-3" />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Metode bayar
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => onPaymentMethodChange(m)}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-bold transition-colors",
                      paymentMethod === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    )}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "cash" ? (
              <div className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  Uang diterima
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    inputMode="numeric"
                    value={uangDiterima}
                    onChange={(e) => {
                      const n = parseRupiah(e.target.value);
                      onUangDiterimaChange(n > 0 ? formatAngka(n) : "");
                    }}
                    placeholder="0"
                    className="pl-9 text-right font-bold"
                    autoFocus
                  />
                </div>
                {kembalian !== null && (
                  <div className="flex justify-between rounded-lg bg-secondary px-3 py-2">
                    <span className="text-sm font-semibold">Kembalian</span>
                    <span className="text-sm font-bold text-accent">
                      {formatRupiah(kembalian)}
                    </span>
                  </div>
                )}
                {uangNum > 0 && uangNum < grandTotal && (
                  <p className="text-xs text-destructive">
                    Uang kurang {formatRupiah(grandTotal - uangNum)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {paymentMethod === "qris"
                    ? "Tunjukkan QR ke pelanggan. Konfirmasi setelah pembayaran berhasil."
                    : `Konfirmasi setelah dana ${PAYMENT_LABELS[paymentMethod].replace(/^\S+\s/, "")} masuk / disetujui.`}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer sticky — ringkasan + tombol bayar ── */}
      <div className="mt-auto border-t border-border bg-card px-4 py-4">
        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
        {promoFreeItems.length > 0 && (
          <div className="mb-1 flex justify-between text-sm text-accent">
            <span>Promo BOGO</span>
            <span>{promoFreeItems.length} item gratis</span>
          </div>
        )}
        {diskonNominal > 0 && (
          <div className="mb-1 flex justify-between text-sm text-primary">
            <span>Diskon {diskonPersen}%</span>
            <span>-{formatRupiah(diskonNominal)}</span>
          </div>
        )}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-extrabold text-primary">
            {formatRupiah(grandTotal)}
          </span>
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={onBayar}
          disabled={!canBayar}
        >
          {saving
            ? "Memproses…"
            : showPayment && paymentMethod !== "cash"
              ? `Konfirmasi Bayar · ${formatRupiah(grandTotal)}`
              : `Bayar · ${formatRupiah(grandTotal)}`}
        </Button>
      </div>
    </div>
  );
}

// ── MOBILE: Vaul Drawer ────────────────────────────────────────────────

function KeranjangDrawer(props: KeranjangPanelProps) {
  return (
    <Drawer.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      // snapPoints: 92% layar — cukup luas, tetap ada gap atas (swipe-to-close hint)
      snapPoints={[0.92]}
    >
      <Drawer.Portal>
        {/* Overlay */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 print:hidden" />

        {/* Panel */}
        <Drawer.Content
          className={cn(
            // JANGAN tambah position/inset/bottom — vaul urus sendiri via
            // DialogPrimitive.Content + CSS data-vaul-drawer transform.
            // Kita hanya styling visual.
            "flex flex-col",
            "rounded-t-2xl border-t border-border bg-background",
            // Tinggi: vaul set via snap point, kita batasi max
            "max-h-[92dvh]",
            "outline-none",
            "print:hidden"
          )}
          aria-label="Keranjang belanja"
        >
          <PanelContent {...props} isDrawer />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ── TABLET: shadcn Sheet ───────────────────────────────────────────────

function KeranjangSheet(props: KeranjangPanelProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          // Di tablet, sheet tidak full-width — dibatasi dan di-center
          "mx-auto max-w-2xl",
          "rounded-t-2xl",
          // Tinggi lebih rendah dari Drawer: tablet punya ruang lebih
          "max-h-[88dvh]",
          "flex flex-col p-0",
          "print:hidden",
          // Sembunyikan X close button bawaan shadcn
          "[&>button:first-child]:hidden"
        )}
      // Sembunyikan tombol Close default shadcn via className override
      // (shadcn SheetContent selalu render SheetClose sebagai first-child)
      >
        <PanelContent {...props} isDrawer={false} />
      </SheetContent>
    </Sheet>
  );
}