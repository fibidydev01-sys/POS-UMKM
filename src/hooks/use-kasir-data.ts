"use client";

import * as React from "react";
import { getMenuTersedia, getKategori, type MenuItem, type Kategori } from "@/lib/db/menu";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { getDiskonPreset, type DiskonPreset } from "@/lib/db/diskon-preset";
import { getPromoAktif, type PromoRule } from "@/lib/db/promo-rule";
import { simpanTransaksi, type CartItem, type HasilTransaksi } from "@/lib/db/transaksi";
import { applyPromo, hitungGrandTotal } from "@/lib/cart/promo-engine";
import { parseRupiah } from "@/lib/utils/currency";
import { features } from "@/lib/config/features";
import { useCurrentUser } from "./use-current-user";
import { useCartStore } from "@/store/cart-store";

interface KasirData {
  menu: MenuItem[];
  kategori: Kategori[];
  config: UmkmConfig | null;
  presets: DiskonPreset[];
  promoRules: PromoRule[];
}

export function useKasirData() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [data, setData] = React.useState<KasirData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (userLoading || !user) return;
    let alive = true;
    (async () => {
      const [m, k, c, p, pr] = await Promise.all([
        getMenuTersedia(user.umkm_id), getKategori(user.umkm_id), getConfig(user.umkm_id),
        getDiskonPreset(user.umkm_id),
        features.promoEngine ? getPromoAktif(user.umkm_id) : Promise.resolve([]),
      ]);
      if (!alive) return;
      setData({ menu: m, kategori: k, config: c, presets: p, promoRules: pr });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, userLoading]);

  return { user, data, isLoading: userLoading || loading };
}

export function useCart(promoRules: PromoRule[]) {
  const items = useCartStore((s) => s.items);
  const diskonPersen = useCartStore((s) => s.diskonPersen);

  const cart = React.useMemo<CartItem[]>(
    () => (features.promoEngine ? applyPromo(items, promoRules) : items),
    [items, promoRules]
  );

  const totals = React.useMemo(() => hitungGrandTotal(cart, diskonPersen), [cart, diskonPersen]);
  return { cart, ...totals };
}

interface BayarResult {
  ok: boolean;
  struk?: HasilTransaksi;
  error?: string;
}

export function useBayar(cart: CartItem[], grandTotal: number) {
  const { user } = useCurrentUser();
  const [saving, setSaving] = React.useState(false);
  const store = useCartStore();

  const bayar = React.useCallback(async (): Promise<BayarResult> => {
    if (!user || store.items.length === 0 || saving) return { ok: false };

    let method = store.paymentMethod;
    let uangFinal: number | null = null;

    if (features.payment) {
      const parsed = method === "cash" ? parseRupiah(store.uangDiterima) : null;
      if (method === "cash" && (parsed === null || parsed < grandTotal)) {
        return { ok: false, error: "Uang diterima kurang dari total belanja." };
      }
      uangFinal = parsed;
    } else {
      method = "cash";
    }

    setSaving(true);
    try {
      const hasil = await simpanTransaksi(
        user.umkm_id, user.id, cart,
        store.diskonPresetId, store.diskonPersen, method, uangFinal
      );
      store.reset();
      return { ok: true, struk: hasil };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan transaksi.";
      return { ok: false, error: msg };
    } finally {
      setSaving(false);
    }
  }, [user, saving, store, cart, grandTotal]);

  return { bayar, saving };
}
