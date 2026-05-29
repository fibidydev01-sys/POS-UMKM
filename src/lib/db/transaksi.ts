import { supabase } from "../supabase/client";
import {
  startOfTodayISO, startOfMonthISO, startOfDaysAgoISO, jakartaDateStr, nHariTerakhir,
} from "../utils/date";

export interface Transaksi {
  id: string;
  umkm_id: string;
  nomor_order: number;
  timestamp: string;
  subtotal: number;
  diskon_persen: number;
  diskon_nominal: number;
  grand_total: number;
  metode_bayar: string;
  catatan: string;
}

export interface TransactionItem {
  id: string;
  transaksi_id: string;
  umkm_id: string;
  menu_item_id: string | null;
  nama_produk: string;
  harga_satuan: number;
  qty: number;
  diskon_persen: number;
  diskon_nominal: number;
  subtotal_item: number;
  final_price_item: number;
}

/** Item di keranjang (belum tersimpan). */
export interface CartItem {
  menu_item_id: string | null;
  nama_produk: string;
  harga_satuan: number;
  qty: number;
  diskon_persen: number;
}

export interface HasilTransaksi {
  trx: Transaksi;
  items: TransactionItem[];
}

/** Nomor order berikutnya — reset harian per UMKM (zona Jakarta). */
export async function nomorOrderBerikutnya(umkmId: string): Promise<number> {
  const { data, error } = await supabase
    .from("transaksi")
    .select("nomor_order")
    .eq("umkm_id", umkmId)
    .gte("timestamp", startOfTodayISO())
    .order("nomor_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = data && data.length ? data[0].nomor_order : 0;
  return max + 1;
}

/**
 * Simpan transaksi + items dengan SNAPSHOT harga.
 * Diskon item dihitung dulu, baru diskon level transaksi pada subtotal.
 */
export async function simpanTransaksi(
  umkmId: string,
  cart: CartItem[],
  diskonPersenTrx: number,
  catatan = ""
): Promise<HasilTransaksi> {
  const itemsHitung = cart.map((c) => {
    const subtotal_item = Math.round(c.harga_satuan * c.qty);
    const diskon_nominal = Math.round((subtotal_item * (c.diskon_persen || 0)) / 100);
    const final_price_item = subtotal_item - diskon_nominal;
    return { ...c, subtotal_item, diskon_nominal, final_price_item };
  });

  const subtotal = itemsHitung.reduce((s, i) => s + i.final_price_item, 0);
  const diskon_nominal_trx = Math.round((subtotal * (diskonPersenTrx || 0)) / 100);
  const grand_total = subtotal - diskon_nominal_trx;
  const nomor_order = await nomorOrderBerikutnya(umkmId);

  const { data: trxRow, error: e1 } = await supabase
    .from("transaksi")
    .insert({
      umkm_id: umkmId,
      nomor_order,
      subtotal,
      diskon_persen: diskonPersenTrx,
      diskon_nominal: diskon_nominal_trx,
      grand_total,
      metode_bayar: "tunai",
      catatan,
    })
    .select()
    .single();
  if (e1 || !trxRow) throw e1 ?? new Error("Gagal menyimpan transaksi");

  const rows = itemsHitung.map((i) => ({
    transaksi_id: trxRow.id,
    umkm_id: umkmId,
    menu_item_id: i.menu_item_id,
    nama_produk: i.nama_produk,
    harga_satuan: i.harga_satuan,
    qty: i.qty,
    diskon_persen: i.diskon_persen,
    diskon_nominal: i.diskon_nominal,
    subtotal_item: i.subtotal_item,
    final_price_item: i.final_price_item,
  }));

  const { data: itemRows, error: e2 } = await supabase
    .from("transaction_items")
    .insert(rows)
    .select();
  if (e2) {
    // rollback sederhana
    await supabase.from("transaksi").delete().eq("id", trxRow.id);
    throw e2;
  }

  return { trx: trxRow as Transaksi, items: (itemRows ?? []) as TransactionItem[] };
}

export async function getRiwayat(umkmId: string, limit = 200): Promise<Transaksi[]> {
  const { data, error } = await supabase
    .from("transaksi")
    .select("*")
    .eq("umkm_id", umkmId)
    .order("timestamp", { ascending: false })
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

export async function hapusTransaksi(id: string): Promise<void> {
  // transaction_items terhapus otomatis (ON DELETE CASCADE).
  const { error } = await supabase.from("transaksi").delete().eq("id", id);
  if (error) throw error;
}

// ── Ringkasan dashboard ──────────────────────────────────────
export interface RingkasanOmzet {
  omzetHariIni: number;
  orderHariIni: number;
  omzetMinggu: number;
  orderMinggu: number;
  omzetBulan: number;
  orderBulan: number;
}

export async function getRingkasanOmzet(umkmId: string): Promise<RingkasanOmzet> {
  const from = [startOfMonthISO(), startOfDaysAgoISO(7)].sort()[0];
  const { data, error } = await supabase
    .from("transaksi")
    .select("timestamp, grand_total")
    .eq("umkm_id", umkmId)
    .gte("timestamp", from);
  if (error) throw error;

  const rows = data ?? [];
  const hariIniStr = jakartaDateStr(new Date());
  const bulanStr = hariIniStr.slice(0, 7);
  const mingguFrom = startOfDaysAgoISO(7);

  const r: RingkasanOmzet = {
    omzetHariIni: 0, orderHariIni: 0,
    omzetMinggu: 0, orderMinggu: 0,
    omzetBulan: 0, orderBulan: 0,
  };
  for (const row of rows) {
    const ds = jakartaDateStr(row.timestamp);
    if (ds === hariIniStr) { r.omzetHariIni += row.grand_total; r.orderHariIni++; }
    if (row.timestamp >= mingguFrom) { r.omzetMinggu += row.grand_total; r.orderMinggu++; }
    if (ds.slice(0, 7) === bulanStr) { r.omzetBulan += row.grand_total; r.orderBulan++; }
  }
  return r;
}

export interface OmzetHarian {
  tanggal: string;
  label: string;
  omzet: number;
}

export async function getOmzet7Hari(umkmId: string): Promise<OmzetHarian[]> {
  const { data, error } = await supabase
    .from("transaksi")
    .select("timestamp, grand_total")
    .eq("umkm_id", umkmId)
    .gte("timestamp", startOfDaysAgoISO(7));
  if (error) throw error;

  const hari = nHariTerakhir(7).map((h) => ({ ...h, omzet: 0 }));
  const idx = new Map(hari.map((h, i) => [h.tanggal, i]));
  for (const row of data ?? []) {
    const i = idx.get(jakartaDateStr(row.timestamp));
    if (i != null) hari[i].omzet += row.grand_total;
  }
  return hari;
}

export interface TopProduk {
  nama_produk: string;
  total_terjual: number;
  total_omzet: number;
}

export async function getTopProduk(umkmId: string, limit = 5): Promise<TopProduk[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("nama_produk, qty, final_price_item, transaksi!inner(timestamp)")
    .eq("umkm_id", umkmId)
    .gte("transaksi.timestamp", startOfMonthISO());
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

export interface AnalisaDiskon {
  nama_produk: string;
  frekuensi_diskon: number;
  total_diskon: number;
  omzet_setelah_diskon: number;
}

export async function getAnalisaDiskon(umkmId: string, limit = 10): Promise<AnalisaDiskon[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("nama_produk, diskon_nominal, final_price_item, transaksi!inner(timestamp)")
    .eq("umkm_id", umkmId)
    .gt("diskon_nominal", 0)
    .gte("transaksi.timestamp", startOfMonthISO());
  if (error) throw error;

  const map = new Map<string, AnalisaDiskon>();
  for (const row of (data ?? []) as any[]) {
    const cur = map.get(row.nama_produk) ?? {
      nama_produk: row.nama_produk, frekuensi_diskon: 0, total_diskon: 0, omzet_setelah_diskon: 0,
    };
    cur.frekuensi_diskon += 1;
    cur.total_diskon += row.diskon_nominal;
    cur.omzet_setelah_diskon += row.final_price_item;
    map.set(row.nama_produk, cur);
  }
  return [...map.values()].sort((a, b) => b.total_diskon - a.total_diskon).slice(0, limit);
}
