import { supabase } from "../supabase/client";
import {
  startOfMonthISO, startOfDaysAgoISO, jakartaDateStr, nHariTerakhir,
} from "../utils/date";

// ── Interfaces ────────────────────────────────────────────────

export interface Transaksi {
  id: string;
  umkm_id: string;
  nomor_order: string;
  status: "completed" | "void" | "refund";
  diskon_preset_id: string | null;
  // diskon_persen TIDAK ADA di kolom transaksi — hanya ada di transaction_items
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

// Internal type untuk promo engine extended fields
interface PromoCartItem extends CartItem {
  _promo_pair_index?: number;
  _is_promo_free?: boolean;
}

// Baris transaction_items siap-INSERT (id digenerate di client).
interface ItemInsertRow {
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

// Supabase row types untuk query results
interface TransaksiRow {
  created_at: string;
  grand_total: number;
  status: string;
}

interface BogoRow {
  harga_satuan: number;
  qty: number;
  transaksi: { status: string; created_at: string } | { status: string; created_at: string }[];
}

interface TopProdukRow {
  nama_produk: string;
  qty: number;
  final_price_item: number;
  item_type: string;
  transaksi: { status: string; created_at: string } | { status: string; created_at: string }[];
}

interface AnalisaDiskonRow {
  harga_satuan: number;
  qty: number;
  diskon_persen: number;
  diskon_preset: { nama: string }[] | null;
  transaksi: { status: string; created_at: string } | { status: string; created_at: string }[];
}

// ── Nomor order ───────────────────────────────────────────────

export async function generateNomorOrder(umkmId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_nomor_order", { p_umkm_id: umkmId });
  if (error) throw error;
  return data as string;
}

// ── Simpan transaksi ──────────────────────────────────────────

/**
 * Simpan transaksi ke Supabase.
 *
 * [FIX B2] PENTING — kenapa BATCH INSERT, bukan loop per-item:
 *   Trigger `check_grand_total` adalah CONSTRAINT TRIGGER DEFERRABLE → dicek
 *   saat COMMIT. Kalau item di-INSERT satu-satu (tiap call = 1 transaksi DB =
 *   1 COMMIT), maka saat commit item ke-1, SUM(final_price_item) ≠ grand_total
 *   → EXCEPTION → transaksi >1 item GAGAL.
 *   Solusi: generate UUID item di CLIENT, lalu INSERT SEMUA item dalam SATU
 *   batch (.insert([...])). Satu batch = satu statement = satu COMMIT, jadi saat
 *   trigger deferred mengecek, semua baris sudah ada → SUM cocok.
 *   (Wajib jalankan 04-schema-final.sql: trigger triggered_by_item_id juga
 *    diubah jadi DEFERRABLE agar pairing BOGO valid dalam satu batch.)
 *
 * [FIX B8] Rollback bersih: kalau batch item gagal → DELETE header. FK
 *   transaction_items.transaksi_id ON DELETE CASCADE menyapu item-nya (bukan
 *   lagi sekadar status=void yang menyisakan sampah).
 *
 * CATATAN SCHEMA:
 * - Kolom diskon_persen TIDAK ADA di tabel transaksi (hanya di transaction_items).
 * - Untuk cash: uang_diterima >= grand_total, kembalian = uang_diterima - grand_total.
 *   V1 (features.payment=false): uang_diterima = grand_total, kembalian = 0.
 * - menu_item_id NULLABLE FK → UUID stale di-set null (snapshot nama tetap ada).
 * - Mendukung item_type 'promo_free' + triggered_by_item_id (V2).
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

  // 1) Validasi menu_item_id — UUID yang tak ada di DB di-set null (FK aman).
  const allMenuIds = [...new Set(
    cart.map((c) => c.menu_item_id).filter((id): id is string => id !== null)
  )];
  const validMenuIds = new Set<string>();
  if (allMenuIds.length > 0) {
    const { data: validRows } = await supabase
      .from("menu_item")
      .select("id")
      .in("id", allMenuIds);
    for (const row of (validRows ?? [])) validMenuIds.add(row.id);
  }

  // 2) Siapkan SEMUA item dengan id UUID digenerate di client.
  //    pairKey memakai ORIGINAL menu_item_id (bukan yang disanitasi) agar
  //    pasangan beli↔gratis (BOGO) tetap stabil walau UUID-nya stale.
  const transaksiId = crypto.randomUUID();

  const prepared: { id: string; pairKey: string | null; isPromoFree: boolean; row: ItemInsertRow }[] =
    cart.map((c) => {
      const extended = c as PromoCartItem;
      const originalMenuId = c.menu_item_id;
      const safeMenuId = originalMenuId && validMenuIds.has(originalMenuId) ? originalMenuId : null;
      const pairIndex = extended._promo_pair_index ?? null;
      const pairKey = originalMenuId && pairIndex !== null ? `${originalMenuId}_${pairIndex}` : null;
      const isPromoFree = c.item_type === "promo_free";
      const itemId = crypto.randomUUID();

      if (isPromoFree) {
        return {
          id: itemId, pairKey, isPromoFree,
          row: {
            id: itemId, transaksi_id: transaksiId, umkm_id: umkmId,
            menu_item_id: safeMenuId, nama_produk: c.nama_produk,
            harga_satuan: c.harga_satuan, qty: c.qty,
            item_type: "promo_free", diskon_persen: 0, diskon_preset_id: null,
            triggered_by_item_id: null, // diisi di step 3
            final_price_item: 0,
          },
        };
      }

      const hasDiskon = diskonHeaderPersen > 0;
      const persen = hasDiskon ? diskonHeaderPersen : 0;
      const final_price_item = Math.round(c.harga_satuan * c.qty * (1 - persen / 100));

      return {
        id: itemId, pairKey, isPromoFree,
        row: {
          id: itemId, transaksi_id: transaksiId, umkm_id: umkmId,
          menu_item_id: safeMenuId, nama_produk: c.nama_produk,
          harga_satuan: c.harga_satuan, qty: c.qty,
          item_type: hasDiskon ? "discounted" : "normal",
          diskon_persen: persen,
          diskon_preset_id: hasDiskon ? diskonHeaderPresetId : null,
          triggered_by_item_id: null,
          final_price_item,
        },
      };
    });

  // 3) Pasangkan promo_free → id item pemicu (parent) via pairKey.
  const pairToId = new Map<string, string>();
  for (const p of prepared) if (!p.isPromoFree && p.pairKey) pairToId.set(p.pairKey, p.id);
  for (const p of prepared) {
    if (p.isPromoFree && p.pairKey) p.row.triggered_by_item_id = pairToId.get(p.pairKey) ?? null;
  }

  // 4) Hitung grand_total & kembalian.
  const grand_total = prepared.reduce((s, p) => s + p.row.final_price_item, 0);
  const uangFinalForInsert = paymentMethod === "cash"
    ? (uangDiterima !== null && uangDiterima >= grand_total ? uangDiterima : grand_total)
    : null;
  const kembalianFinalForInsert = paymentMethod === "cash"
    ? (uangFinalForInsert! - grand_total)
    : null;

  const nomor_order = await generateNomorOrder(umkmId);

  // 5) INSERT header (pakai id yang sudah kita generate).
  const { data: trxRow, error: e1 } = await supabase
    .from("transaksi")
    .insert({
      id: transaksiId,
      umkm_id: umkmId,
      nomor_order,
      status: "completed",
      diskon_preset_id: diskonHeaderPresetId,
      payment_method: paymentMethod,
      grand_total,
      uang_diterima: uangFinalForInsert,
      kembalian: kembalianFinalForInsert,
      kasir_id: kasirId,
    })
    .select()
    .single();

  if (e1 || !trxRow) throw e1 ?? new Error("Gagal menyimpan transaksi");

  // 6) INSERT SEMUA item dalam SATU batch. Trigger grand_total & triggered_by
  //    di-DEFER → dicek saat COMMIT, saat semua baris sudah ada (SUM cocok).
  //    Self-FK triggered_by_item_id valid karena parent & child satu statement.
  let insertedItems: TransactionItem[] = [];
  if (prepared.length > 0) {
    const { data, error: eItems } = await supabase
      .from("transaction_items")
      .insert(prepared.map((p) => p.row))
      .select();

    if (eItems || !data) {
      // [FIX B8] Rollback bersih: hapus header, item ikut CASCADE (FIX B3 di SQL).
      await supabase.from("transaksi").delete().eq("id", transaksiId);
      throw eItems ?? new Error("Gagal menyimpan item transaksi");
    }
    insertedItems = data as TransactionItem[];
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
  nilaiBogoBulan: number;
  jumlahItemGratisBulan: number;
}

export async function getRingkasanOmzet(umkmId: string): Promise<RingkasanOmzet> {
  const from = [startOfMonthISO(), startOfDaysAgoISO(7)].sort()[0];
  const { data, error } = await supabase
    .from("transaksi")
    .select("created_at, grand_total, status")
    .eq("umkm_id", umkmId)
    .gte("created_at", from);
  if (error) throw error;

  const rows = (data ?? []) as TransaksiRow[];
  const hariIniStr = jakartaDateStr(new Date());
  const bulanStr = hariIniStr.slice(0, 7);
  const mingguFrom = startOfDaysAgoISO(7);

  const r: RingkasanOmzet = {
    omzetHariIni: 0, orderHariIni: 0,
    omzetMinggu: 0, orderMinggu: 0,
    omzetBulan: 0, orderBulan: 0,
    refundBulan: 0, jumlahRefundBulan: 0,
    nilaiBogoBulan: 0, jumlahItemGratisBulan: 0,
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

  // Nilai item gratis (BOGO) bulan ini
  const { data: bogoData } = await supabase
    .from("transaction_items")
    .select("harga_satuan, qty, transaksi!inner(status, created_at)")
    .eq("umkm_id", umkmId)
    .eq("item_type", "promo_free")
    .eq("transaksi.status", "completed")
    .gte("transaksi.created_at", startOfMonthISO());

  for (const row of (bogoData ?? []) as BogoRow[]) {
    r.nilaiBogoBulan += row.harga_satuan * row.qty;
    r.jumlahItemGratisBulan += row.qty;
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

  const rows = (data ?? []) as TransaksiRow[];
  const hariIniStr = jakartaDateStr(new Date());
  const bulanStr = hariIniStr.slice(0, 7);
  const mingguFrom = startOfDaysAgoISO(7);

  const r: RingkasanOmzet = {
    omzetHariIni: 0, orderHariIni: 0,
    omzetMinggu: 0, orderMinggu: 0,
    omzetBulan: 0, orderBulan: 0,
    refundBulan: 0, jumlahRefundBulan: 0,
    nilaiBogoBulan: 0, jumlahItemGratisBulan: 0,
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
  for (const row of (data ?? []) as { created_at: string; grand_total: number }[]) {
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
  for (const row of (data ?? []) as TopProdukRow[]) {
    const cur = map.get(row.nama_produk) ?? { nama_produk: row.nama_produk, total_terjual: 0, total_omzet: 0 };
    cur.total_terjual += row.qty;
    cur.total_omzet += row.final_price_item;
    map.set(row.nama_produk, cur);
  }
  return [...map.values()].sort((a, b) => b.total_terjual - a.total_terjual).slice(0, limit);
}

export interface AnalisaDiskon {
  nama_preset: string;
  persen?: number;
  kali_dipakai: number;
  total_nilai_diskon: number;
}

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
  for (const row of (data ?? []) as AnalisaDiskonRow[]) {
    const nama = (row.diskon_preset?.[0]?.nama) ?? `Diskon ${row.diskon_persen}%`;
    const nilaiDiskon = Math.round(row.harga_satuan * row.qty * row.diskon_persen / 100);
    const cur = map.get(nama) ?? { nama_preset: nama, persen: row.diskon_persen, kali_dipakai: 0, total_nilai_diskon: 0 };
    cur.kali_dipakai++;
    cur.total_nilai_diskon += nilaiDiskon;
    map.set(nama, cur);
  }
  return [...map.values()].sort((a, b) => b.total_nilai_diskon - a.total_nilai_diskon).slice(0, limit);
}
