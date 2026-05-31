import type { CartItem } from "../db/transaksi";
import type { PromoRule } from "../db/promo-rule";

interface PromoCartItem extends CartItem {
  item_type?: "normal" | "discounted" | "promo_free";
  final_price_item?: number;
  _promo_pair_index?: number;
  _is_promo_free?: boolean;
}

export function applyPromo(cart: CartItem[], rules: PromoRule[]): CartItem[] {
  if (rules.length === 0) return cart;

  const ruleByItem = new Map<string, PromoRule>();
  for (const r of rules) {
    ruleByItem.set(r.menu_item_id, r);
  }

  const result: CartItem[] = [];

  for (const item of cart) {
    if (!item.menu_item_id) {
      result.push(item);
      continue;
    }

    const rule = ruleByItem.get(item.menu_item_id);
    if (!rule) {
      result.push(item);
      continue;
    }

    const { qty_beli, qty_gratis } = rule;
    const setSize = qty_beli + qty_gratis;
    const jumlahSet = Math.floor(item.qty / setSize);
    const qtyGratisTotal = jumlahSet * qty_gratis;

    if (qtyGratisTotal === 0) {
      result.push(item);
      continue;
    }

    for (let i = 0; i < jumlahSet; i++) {
      const bayarItem: PromoCartItem = {
        ...item, qty: qty_beli, diskon_preset_id: null, diskon_persen: 0, _promo_pair_index: i,
      };
      result.push(bayarItem as CartItem);

      const gratisItem: PromoCartItem = {
        ...item, qty: qty_gratis, diskon_preset_id: null, diskon_persen: 0,
        item_type: "promo_free" as const, final_price_item: 0, _promo_pair_index: i, _is_promo_free: true,
      };
      result.push(gratisItem as CartItem);
    }

    const sisaQty = item.qty % setSize;
    if (sisaQty > 0) {
      result.push({ ...item, qty: sisaQty });
    }
  }

  return result;
}

export function hitungGrandTotal(
  cart: CartItem[],
  diskonPersen: number
): { subtotal: number; diskonNominal: number; grandTotal: number } {
  const subtotal = cart.reduce((s, c) => {
    const extended = c as PromoCartItem;
    if (extended.item_type === "promo_free") return s;
    return s + c.harga_satuan * c.qty;
  }, 0);

  const diskonNominal = diskonPersen > 0 ? Math.round(subtotal * diskonPersen / 100) : 0;
  return { subtotal, diskonNominal, grandTotal: subtotal - diskonNominal };
}
