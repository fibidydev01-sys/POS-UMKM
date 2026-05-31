"use client";

import { create } from "zustand";
import type { CartItem } from "@/lib/db/transaksi";

export type PaymentMethod = "cash" | "qris" | "transfer" | "debit";

interface TambahArg {
  id: string;
  nama: string;
  harga: number;
}

interface CartState {
  /** Item mentah pilihan kasir (sebelum promo engine diterapkan). */
  items: CartItem[];
  diskonPresetId: string | null;
  diskonPersen: number;
  paymentMethod: PaymentMethod;
  uangDiterima: string;

  // actions
  tambah: (item: TambahArg) => void;
  ubahQty: (menuItemId: string | null, delta: number) => void;
  hapus: (menuItemId: string | null) => void;
  setDiskon: (presetId: string | null, persen: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setUangDiterima: (v: string) => void;
  reset: () => void;

  // derived
  totalQty: () => number;
}

const initial = {
  items: [] as CartItem[],
  diskonPresetId: null as string | null,
  diskonPersen: 0,
  paymentMethod: "cash" as PaymentMethod,
  uangDiterima: "",
};

export const useCartStore = create<CartState>((set, get) => ({
  ...initial,

  tambah: ({ id, nama, harga }) =>
    set((state) => {
      const idx = state.items.findIndex((c) => c.menu_item_id === id);
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
        return { items };
      }
      return {
        items: [
          ...state.items,
          {
            menu_item_id: id,
            nama_produk: nama,
            harga_satuan: harga,
            qty: 1,
            diskon_preset_id: null,
            diskon_persen: 0,
          },
        ],
      };
    }),

  ubahQty: (menuItemId, delta) =>
    set((state) => ({
      items: state.items
        .map((c) => (c.menu_item_id === menuItemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0),
    })),

  hapus: (menuItemId) =>
    set((state) => ({ items: state.items.filter((c) => c.menu_item_id !== menuItemId) })),

  setDiskon: (presetId, persen) => set({ diskonPresetId: presetId, diskonPersen: persen }),

  setPaymentMethod: (method) =>
    set((state) => ({
      paymentMethod: method,
      // reset uang diterima saat ganti ke non-tunai
      uangDiterima: method === "cash" ? state.uangDiterima : "",
    })),

  setUangDiterima: (v) => set({ uangDiterima: v }),

  reset: () => set({ ...initial }),

  totalQty: () => get().items.reduce((s, c) => s + c.qty, 0),
}));
