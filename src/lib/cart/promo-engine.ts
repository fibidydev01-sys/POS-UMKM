import type { CartItem } from "../db/transaksi";
import type { PromoRule } from "../db/promo-rule";

/**
 * Pure function — tidak ada IO, tidak ada side effect.
 * Dipanggil setiap kali cart berubah di kasir page.
 *
 * Formula qty gratis (berlaku untuk semua tipe promo):
 *   qty_gratis_total = FLOOR(qty_dipesan / (qty_beli + qty_gratis)) * qty_gratis
 *   qty_bayar        = qty_dipesan - qty_gratis_total
 *
 * Contoh BOGO (qty_beli=1, qty_gratis=1):
 *   Pesan 1 → gratis 0, bayar 1
 *   Pesan 2 → gratis 1, bayar 1
 *   Pesan 3 → gratis 1, bayar 2
 *   Pesan 4 → gratis 2, bayar 2
 *
 * Contoh Buy2Get1 (qty_beli=2, qty_gratis=1):
 *   Pesan 2 → gratis 0, bayar 2
 *   Pesan 3 → gratis 1, bayar 2
 *   Pesan 4 → gratis 1, bayar 3
 *   Pesan 6 → gratis 2, bayar 4
 */

// Internal type untuk extended CartItem dengan promo metadata
interface PromoCartItem extends CartItem {
  item_type?: "normal" | "discounted" | "promo_free";
  final_price_item?: number;
  _promo_pair_index?: number;
  _is_promo_free?: boolean;
}

export function applyPromo(cart: CartItem[], rules: PromoRule[]): CartItem[] {
  if (rules.length === 0) return cart;

  // Map menu_item_id → promo rule aktif
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
      // Belum cukup qty untuk trigger promo
      result.push(item);
      continue;
    }

    // Pisah jadi dua baris: yang bayar + yang gratis
    // Setiap pasangan punya triggered_by link tersendiri
    // (INSERT sequential di simpanTransaksi yang handle UUID-nya)
    for (let i = 0; i < jumlahSet; i++) {
      // Baris bayar (qty_beli per set)
      const bayarItem: PromoCartItem = {
        ...item,
        qty: qty_beli,
        diskon_preset_id: null,
        diskon_persen: 0,
        _promo_pair_index: i,
      };
      result.push(bayarItem as CartItem);

      // Baris gratis (qty_gratis per set)
      const gratisItem: PromoCartItem = {
        ...item,
        qty: qty_gratis,
        diskon_preset_id: null,
        diskon_persen: 0,
        item_type: "promo_free" as const,
        final_price_item: 0,
        _promo_pair_index: i,
        _is_promo_free: true,
      };
      result.push(gratisItem as CartItem);
    }

    // Sisa qty yang tidak masuk set promo
    const sisaQty = item.qty % setSize;
    if (sisaQty > 0) {
      result.push({ ...item, qty: sisaQty });
    }

    // Hapus baris original — sudah dipecah
    // (result sudah ditambah di atas, baris asli tidak di-push)
  }

  return result;
}

/**
 * Hitung grand_total estimasi dari cart yang sudah diapply promo.
 * Dipakai hanya untuk tampilan UI — server yang hitung ulang saat INSERT.
 */
export function hitungGrandTotal(
  cart: CartItem[],
  diskonPersen: number
): { subtotal: number; diskonNominal: number; grandTotal: number } {
  const subtotal = cart.reduce((s, c) => {
    const extended = c as PromoCartItem;
    if (extended.item_type === "promo_free") return s;
    return s + c.harga_satuan * c.qty;
  }, 0);

  const diskonNominal = diskonPersen > 0
    ? Math.round(subtotal * diskonPersen / 100)
    : 0;

  return { subtotal, diskonNominal, grandTotal: subtotal - diskonNominal };
}