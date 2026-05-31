import { supabase } from "../supabase/client";
import {
  startOfTodayISO, startOfMonthISO, startOfDaysAgoISO, jakartaDateStr, nHariTerakhir,
} from "../utils/date";

// ── Interfaces ────────────────────────────────────────────────

export interface Transaksi {
  id: string;
  umkm_id: string;
  nomor_order: string;
  status: "completed" | "void" | "refund";
  diskon_preset_id: string | null;
  payment_method: "cash" | "qris" | "transfer" | "debit";
  grand_total: number;
  uang_diterima: number | null;
  kembalian: number | null;
  kasir_id: string;
  void_by: string | null;
  void_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaksi_id: string;
  umkm_id: string;
  menu_item_id: string | null;
  nama_produk: string;
  harga_satuan: number;
  qty: number;
  item_type: "normal" | "discounted" | "promo_free";
  diskon_persen: number;
  diskon_preset_id: string | null;
  triggered_by_item_id: string | null;
  final_price_item: number;
}

export interface CartItem {
  menu_item_id: string | null;
  nama_produk: string;
  harga_satuan: number;
  qty: number;
  diskon_preset_id: string | null;
  diskon_persen: number;
  // ditambah dari promo engine
  item_type?: "normal" | "discounted" | "promo_free";
  final_price_item?: number;
}

export interface HasilTransaksi {
  trx: Transaksi;
  items: TransactionItem[];
}

// ── Nomor order ───────────────────────────────────────────────

export async function generateNomorOrder(umkmId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_nomor_order", { p_umkm_id: umkmId });
  if (error) throw error;
  return data as string;
}

// ── Simpan transaksi ──────────────────────────────────────────

/**
 * Mendukung item_type = 'promo_free' dan triggered_by_item_id (V2 mode).
 * Juga mendukung diskon tanpa preset_id (V1 ENV mode).
 *
 * FIX: hasDiskon tidak lagi bergantung pada diskonHeaderPresetId !== null.
 * Ini memungkinkan V1 mode (hardcoded preset, preset_id = null) tetap
 * menerapkan diskon dengan benar.
 *
 * INSERT SEQUENTIAL untuk promo_free karena triggered_by_item_id
 * butuh UUID dari baris yang di-INSERT sebelumnya.
 */
export async function simpanTransaksi(
  umkmId: string,
  kasirId: string,
  cart: CartItem[],
  diskonHeaderPresetId: string | null,
  diskonHeaderPersen: number,
  paymentMethod: "cash" | "qris" | "transfer" | "debit",
  uangDiterima: number | null
): Promise<HasilTransaksi> {

  // Hitung final_price per item
  const itemsHitung = cart.map((c) => {
    // Item promo_free: harga selalu 0, tidak kena diskon header
    if (c.item_type === "promo_free") {
      return {
        ...c,
        item_type: "promo_free" as const,
        diskon_persen: 0,
        diskon_preset_id: null,
        final_price_item: 0,
      };
    }

    // FIX: hasDiskon hanya cek persen > 0.
    // Sebelumnya: diskonHeaderPersen > 0 && diskonHeaderPresetId !== null
    // Bug: V1 mode (preset_id = null) tidak pernah masuk kondisi hasDiskon → diskon tidak diterapkan.
    const hasDiskon = diskonHeaderPersen > 0;
    const persen = hasDiskon ? diskonHeaderPersen : 0;
    const final_price_item = Math.round(c.harga_satuan * c.qty * (1 - persen / 100));
    const item_type: "normal" | "discounted" = hasDiskon ? "discounted" : "normal";

    return {
      ...c,
      item_type,
      diskon_persen: persen,
      // V1 mode: preset_id = null tapi diskon tetap diterapkan (schema sudah difix)
      diskon_preset_id: hasDiskon ? diskonHeaderPresetId : null,
      final_price_item,
    };
  });

  const grand_total = itemsHitung.reduce((s, i) => s + i.final_price_item, 0);
  const kembalian =
    paymentMethod === "cash" && uangDiterima !== null
      ? uangDiterima - grand_total
      : null;

  const nomor_order = await generateNomorOrder(umkmId);

  // INSERT header
  const { data: trxRow, error: e1 } = await supabase
    .from("transaksi")
    .insert({
      umkm_id: umkmId,
      nomor_order,
      status: "completed",
      diskon_preset_id: diskonHeaderPresetId,
      payment_method: paymentMethod,
      grand_total,
      uang_diterima: paymentMethod === "cash" ? uangDiterima : null,
      kembalian: paymentMethod === "cash" ? kembalian : null,
      kasir_id: kasirId,
    })
    .select()
    .single();

  if (e1 || !trxRow) throw e1 ?? new Error("Gagal menyimpan transaksi");

  // INSERT items — sequential untuk handle triggered_by_item_id
  const insertedItems: TransactionItem[] = [];
  const pairToId = new Map<string, string>();

  for (const item of itemsHitung) {
    const isPromoFree = item.item_type === "promo_free";
    const pairIndex = (item as any)._promo_pair_index ?? null;
    const pairKey = item.menu_item_id && pairIndex !== null
      ? `${item.menu_item_id}_${pairIndex}`
      : null;

    let triggered_by_item_id: string | null = null;
    if (isPromoFree && pairKey) {
      triggered_by_item_id = pairToId.get(pairKey) ?? null;
    }

    const { data: insertedItem, error: eItem } = await supabase
      .from("transaction_items")
      .insert({
        transaksi_id: trxRow.id,
        umkm_id: umkmId,
        menu_item_id: item.menu_item_id,
        nama_produk: item.nama_produk,
        harga_satuan: item.harga_satuan,
        qty: item.qty,
        item_type: item.item_type,
        diskon_persen: item.diskon_persen,
        diskon_preset_id: item.diskon_preset_id,
        triggered_by_item_id,
        final_price_item: item.final_price_item,
      })
      .select()
      .single();

    if (eItem || !insertedItem) {
      // Rollback sederhana — void header
      await supabase.from("transaksi").update({
        status: "void",
        void_by: kasirId,
        void_at: new Date().toISOString(),
        void_reason: "Rollback: gagal INSERT items",
      }).eq("id", trxRow.id);
      throw eItem ?? new Error("Gagal INSERT item");
    }

    if (!isPromoFree && pairKey) {
      pairToId.set(pairKey, insertedItem.id);
    }

    insertedItems.push(insertedItem as TransactionItem);
  }

  return { trx: trxRow as Transaksi, items: insertedItems };
}

// ── Void & Refund ─────────────────────────────────────────────

export async function voidTransaksi(
  id: string,
  voidBy: string,
  voidReason = "Dibatalkan oleh owner"
): Promise<void> {
  const { error } = await supabase
    .from("transaksi")
    .update({
      status: "void",
      void_by: voidBy,
      void_at: new Date().toISOString(),
      void_reason: voidReason,
    })
    .eq("id", id)
    .eq("status", "completed");
  if (error) throw error;
}

export async function refundTransaksi(
  id: string,
  refundBy: string,
  alasanRefund: string
): Promise<void> {
  const { error } = await supabase
    .from("transaksi")
    .update({
      status: "refund",
      void_by: refundBy,
      void_at: new Date().toISOString(),
      void_reason: alasanRefund,
    })
    .eq("id", id)
    .eq("status", "completed");
  if (error) throw error;
}

// ── Riwayat & detail ─────────────────────────────────────────

export async function getRiwayat(umkmId: string, limit = 200): Promise<Transaksi[]> {
  const { data, error } = await supabase
    .from("transaksi")
    .select("*")
    .eq("umkm_id", umkmId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Transaksi[];
}

export async function getItemsByTransaksi(transaksiId: string): Promise<TransactionItem[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("*")
    .eq("transaksi_id", transaksiId)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransactionItem[];
}

// ── Dashboard ─────────────────────────────────────────────────

export interface RingkasanOmzet {
  omzetHariIni: number;
  orderHariIni: number;
  omzetMinggu: number;
  orderMinggu: number;
  omzetBulan: number;
  orderBulan: number;
  refundBulan: number;
  jumlahRefundBulan: number;
}

export async function getRingkasanOmzet(umkmId: string): Promise<RingkasanOmzet> {
  const from = [startOfMonthISO(), startOfDaysAgoISO(7)].sort()[0];
  const { data, error } = await supabase
    .from("transaksi")
    .select("created_at, grand_total, status")
    .eq("umkm_id", umkmId)
    .gte("created_at", from);
  if (error) throw error;

  const rows = data ?? [];
  const hariIniStr = jakartaDateStr(new Date());
  const bulanStr = hariIniStr.slice(0, 7);
  const mingguFrom = startOfDaysAgoISO(7);

  const r: RingkasanOmzet = {
    omzetHariIni: 0, orderHariIni: 0,
    omzetMinggu: 0, orderMinggu: 0,
    omzetBulan: 0, orderBulan: 0,
    refundBulan: 0, jumlahRefundBulan: 0,
  };

  for (const row of rows) {
    const ds = jakartaDateStr(row.created_at);
    const isCompleted = row.status === "completed";
    const isRefund = row.status === "refund";

    if (isCompleted) {
      if (ds === hariIniStr) { r.omzetHariIni += row.grand_total; r.orderHariIni++; }
      if (row.created_at >= mingguFrom) { r.omzetMinggu += row.grand_total; r.orderMinggu++; }
      if (ds.slice(0, 7) === bulanStr) { r.omzetBulan += row.grand_total; r.orderBulan++; }
    }
    if (isRefund && ds.slice(0, 7) === bulanStr) {
      r.refundBulan += row.grand_total;
      r.jumlahRefundBulan++;
    }
  }
  return r;
}

export async function getRingkasanPerKasir(
  umkmId: string,
  kasirId: string
): Promise<RingkasanOmzet> {
  const from = startOfMonthISO();
  const { data, error } = await supabase
    .from("transaksi")
    .select("created_at, grand_total, status")
    .eq("umkm_id", umkmId)
    .eq("kasir_id", kasirId)
    .eq("status", "completed")
    .gte("created_at", from);
  if (error) throw error;

  const rows = data ?? [];
  const hariIniStr = jakartaDateStr(new Date());
  const bulanStr = hariIniStr.slice(0, 7);
  const mingguFrom = startOfDaysAgoISO(7);

  const r: RingkasanOmzet = {
    omzetHariIni: 0, orderHariIni: 0,
    omzetMinggu: 0, orderMinggu: 0,
    omzetBulan: 0, orderBulan: 0,
    refundBulan: 0, jumlahRefundBulan: 0,
  };
  for (const row of rows) {
    const ds = jakartaDateStr(row.created_at);
    if (ds === hariIniStr) { r.omzetHariIni += row.grand_total; r.orderHariIni++; }
    if (row.created_at >= mingguFrom) { r.omzetMinggu += row.grand_total; r.orderMinggu++; }
    if (ds.slice(0, 7) === bulanStr) { r.omzetBulan += row.grand_total; r.orderBulan++; }
  }
  return r;
}

export interface OmzetHarian { tanggal: string; label: string; omzet: number; }

export async function getOmzet7Hari(umkmId: string): Promise<OmzetHarian[]> {
  const { data, error } = await supabase
    .from("transaksi")
    .select("created_at, grand_total")
    .eq("umkm_id", umkmId)
    .eq("status", "completed")
    .gte("created_at", startOfDaysAgoISO(7));
  if (error) throw error;

  const hari = nHariTerakhir(7).map((h) => ({ ...h, omzet: 0 }));
  const idx = new Map(hari.map((h, i) => [h.tanggal, i]));
  for (const row of data ?? []) {
    const i = idx.get(jakartaDateStr(row.created_at));
    if (i != null) hari[i].omzet += row.grand_total;
  }
  return hari;
}

export interface TopProduk { nama_produk: string; total_terjual: number; total_omzet: number; }

export async function getTopProduk(umkmId: string, limit = 5): Promise<TopProduk[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("nama_produk, qty, final_price_item, item_type, transaksi!inner(status, created_at)")
    .eq("umkm_id", umkmId)
    .eq("transaksi.status", "completed")
    .gte("transaksi.created_at", startOfMonthISO());
  if (error) throw error;

  const map = new Map<string, TopProduk>();
  for (const row of (data ?? []) as any[]) {
    const cur = map.get(row.nama_produk) ?? { nama_produk: row.nama_produk, total_terjual: 0, total_omzet: 0 };
    cur.total_terjual += row.qty;
    cur.total_omzet += row.final_price_item;
    map.set(row.nama_produk, cur);
  }
  return [...map.values()].sort((a, b) => b.total_terjual - a.total_terjual).slice(0, limit);
}

export interface AnalisaDiskon { nama_preset: string; kali_dipakai: number; total_nilai_diskon: number; }

export async function getAnalisaDiskon(umkmId: string, limit = 10): Promise<AnalisaDiskon[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select(`harga_satuan, qty, diskon_persen, diskon_preset:diskon_preset_id(nama), transaksi!inner(status, created_at)`)
    .eq("umkm_id", umkmId)
    .eq("item_type", "discounted")
    .eq("transaksi.status", "completed")
    .gte("transaksi.created_at", startOfMonthISO());
  if (error) throw error;

  const map = new Map<string, AnalisaDiskon>();
  for (const row of (data ?? []) as any[]) {
    // FIX: fallback ke "Diskon X%" jika preset_id null (V1 ENV mode pakai hardcoded preset)
    const nama = row.diskon_preset?.nama ?? `Diskon ${row.diskon_persen}%`;
    const nilaiDiskon = Math.round(row.harga_satuan * row.qty * row.diskon_persen / 100);
    const cur = map.get(nama) ?? { nama_preset: nama, kali_dipakai: 0, total_nilai_diskon: 0 };
    cur.kali_dipakai++;
    cur.total_nilai_diskon += nilaiDiskon;
    map.set(nama, cur);
  }
  return [...map.values()].sort((a, b) => b.total_nilai_diskon - a.total_nilai_diskon).slice(0, limit);
}
