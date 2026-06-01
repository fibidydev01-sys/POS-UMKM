"use client";

import * as React from "react";
import type { CartItem } from "@/lib/db/transaksi";
import type { DiskonPreset } from "@/lib/db/diskon-preset";
import type { PaymentMethod } from "@/store/cart-store";
import { useIsDesktop } from "@/hooks/use-media-query";
import { hitungGrandTotal } from "@/lib/cart/promo-engine";
import { parseRupiah } from "@/lib/utils/currency";
import { features } from "@/lib/config/features";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

import { CartLine, CartPromoLine } from "./cart-line";
import { DiscountPicker } from "./discount-picker";
import { PaymentMethodPicker } from "./payment-method";
import { CartSummary } from "./cart-summary";

interface ExtendedCartItem extends CartItem {
  item_type?: "normal" | "discounted" | "promo_free";
}

export interface CartPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Keranjang final (sudah lewat promo engine). */
  cart: CartItem[];
  /** Keranjang mentah (pilihan kasir, editable). */
  cartRaw: CartItem[];
  onUbahQty: (menuItemId: string | null, delta: number) => void;
  presets: DiskonPreset[];
  diskonPresetId: string | null;
  diskonPersen: number;
  onDiskonChange: (presetId: string | null, persen: number) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  uangDiterima: string;
  onUangDiterimaChange: (v: string) => void;
  onBayar: () => void;
  saving: boolean;
  /** V3: tenant punya PG QRIS aktif → metode QRIS lewat gateway (QR otomatis). */
  qrisPgReady?: boolean;
  /** V3: navigasi ke setup gateway bila QRIS dipilih tapi PG belum aktif. */
  onSetupGateway?: () => void;
}

/**
 * CartPanel — SATU komponen adaptif.
 * Desktop: Sheet kanan. Mobile: Drawer bawah.
 */
export function CartPanel(props: CartPanelProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop === null) return null;

  if (isDesktop) {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md" showClose>
          <PanelBody {...props} headerSlot={<SheetHeaderTitle qty={totalRaw(props.cartRaw)} />} footerSlot="sheet" />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <PanelBody {...props} headerSlot={<DrawerHeaderTitle qty={totalRaw(props.cartRaw)} />} footerSlot="drawer" />
      </DrawerContent>
    </Drawer>
  );
}

function totalRaw(cartRaw: CartItem[]) {
  return cartRaw.reduce((s, c) => s + c.qty, 0);
}

function SheetHeaderTitle({ qty }: { qty: number }) {
  return (
    <SheetHeader>
      <SheetTitle>Keranjang</SheetTitle>
      <p className="text-sm text-muted-foreground">{qty} item</p>
    </SheetHeader>
  );
}

function DrawerHeaderTitle({ qty }: { qty: number }) {
  return (
    <DrawerHeader>
      <DrawerTitle>Keranjang</DrawerTitle>
      <p className="text-sm text-muted-foreground">{qty} item</p>
    </DrawerHeader>
  );
}

/** Isi panel — sama untuk Drawer & Sheet. */
function PanelBody({
  cart,
  cartRaw,
  onUbahQty,
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
  qrisPgReady,
  onSetupGateway,
  headerSlot,
  footerSlot,
}: CartPanelProps & { headerSlot: React.ReactNode; footerSlot: "drawer" | "sheet" }) {
  const showPayment = features.payment;
  const { subtotal, diskonNominal, grandTotal } = hitungGrandTotal(cart, diskonPersen);

  // V3: QRIS lewat PG aktif → QR otomatis (bukan konfirmasi manual).
  const autoQris = !!qrisPgReady && features.qrisPayment && paymentMethod === "qris";

  const promoFreeItems = (cart as ExtendedCartItem[]).filter(
    (c) => c.item_type === "promo_free"
  );

  const uangNum = parseRupiah(uangDiterima);
  const canBayar =
    cartRaw.length > 0 &&
    !saving &&
    grandTotal > 0 &&
    (!showPayment || paymentMethod !== "cash" || uangNum >= grandTotal);

  const Footer = footerSlot === "drawer" ? DrawerFooter : SheetFooter;

  return (
    <div className="flex h-full flex-col">
      {headerSlot}

      <ScrollArea className="flex-1">
        <div className="px-4 py-2">
          {cartRaw.map((c) => (
            <CartLine
              key={c.menu_item_id ?? c.nama_produk}
              item={c}
              onUbahQty={onUbahQty}
            />
          ))}

          {promoFreeItems.map((c, i) => (
            <CartPromoLine key={`promo-${i}`} item={c} />
          ))}

          <Separator className="my-3" />

          <DiscountPicker
            presets={presets}
            selectedId={diskonPresetId}
            onChange={onDiskonChange}
          />

          {showPayment && (
            <>
              <Separator className="my-3" />
              <PaymentMethodPicker
                method={paymentMethod}
                onMethodChange={onPaymentMethodChange}
                uangDiterima={uangDiterima}
                onUangChange={onUangDiterimaChange}
                grandTotal={grandTotal}
                autoQris={autoQris}
                pgReady={!!qrisPgReady}
                onSetupGateway={onSetupGateway}
              />
            </>
          )}
        </div>
      </ScrollArea>

      <Footer className={cn(footerSlot === "sheet" && "mt-auto")}>
        <CartSummary
          subtotal={subtotal}
          diskonNominal={diskonNominal}
          diskonPersen={diskonPersen}
          grandTotal={grandTotal}
          promoFreeCount={promoFreeItems.length}
          canBayar={canBayar}
          saving={saving}
          showPayment={showPayment}
          isNonCash={paymentMethod !== "cash"}
          autoQris={autoQris}
          onBayar={onBayar}
        />
      </Footer>
    </div>
  );
}
