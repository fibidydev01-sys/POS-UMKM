"use client";

import * as XLSX from "xlsx";
import { supabase } from "../supabase/client";
import { BACKUP_SHEET_NAME, BACKUP_HEADERS } from "./excel";

export interface HasilImport {
  ok: boolean;
  pesan: string;
  jumlahTransaksi?: number;
  jumlahItem?: number;
}

/**
 * Restore destruktif untuk UMKM aktif:
 * hapus seluruh transaksi UMKM ini, lalu isi ulang dari Sheet "BACKUP_DATA".
 */
export async function importDariFile(umkmId: string, file: File): Promise<HasilImport> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[BACKUP_SHEET_NAME];
    if (!ws) {
      return { ok: false, pesan: `Sheet "${BACKUP_SHEET_NAME}" tidak ditemukan di file ini.` };
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    if (rows.length === 0) return { ok: false, pesan: "Sheet backup kosong." };

    // Validasi header
    const cols = Object.keys(rows[0]);
    const wajib = BACKUP_HEADERS.filter((h) => !cols.includes(h));
    if (wajib.length > 0) {
      return { ok: false, pesan: `Kolom backup tidak lengkap: ${wajib.join(", ")}` };
    }

    // Kelompokkan per transaksi
    const trxMap = new Map<string, any>();
    const itemRows: any[] = [];
    for (const r of rows) {
      const tid = String(r.transaksi_id);
      if (!tid) continue;
      if (!trxMap.has(tid)) {
        trxMap.set(tid, {
          id: tid,
          umkm_id: umkmId,
          nomor_order: Number(r.nomor_order) || 0,
          timestamp: new Date(r.timestamp).toISOString(),
          subtotal: Number(r.subtotal_trx) || 0,
          diskon_persen: Number(r.diskon_persen_trx) || 0,
          diskon_nominal: Number(r.diskon_nominal_trx) || 0,
          grand_total: Number(r.grand_total) || 0,
          metode_bayar: String(r.metode_bayar || "tunai"),
          catatan: String(r.catatan || ""),
        });
      }
      itemRows.push({
        transaksi_id: tid,
        umkm_id: umkmId,
        menu_item_id: r.menu_item_id ? String(r.menu_item_id) : null,
        nama_produk: String(r.nama_produk),
        harga_satuan: Number(r.harga_satuan) || 0,
        qty: Number(r.qty) || 0,
        diskon_persen: Number(r.diskon_persen_item) || 0,
        diskon_nominal: Number(r.diskon_nominal_item) || 0,
        subtotal_item: Number(r.subtotal_item) || 0,
        final_price_item: Number(r.final_price_item) || 0,
      });
    }

    const trxList = [...trxMap.values()];

    // 1) Hapus data lama UMKM ini (items ikut terhapus via cascade)
    const del = await supabase.from("transaksi").delete().eq("umkm_id", umkmId);
    if (del.error) throw del.error;

    // 2) Insert ulang transaksi (id eksplisit utk menjaga relasi)
    const insTrx = await supabase.from("transaksi").insert(trxList);
    if (insTrx.error) throw insTrx.error;

    // 3) Insert ulang items
    const insItems = await supabase.from("transaction_items").insert(itemRows);
    if (insItems.error) throw insItems.error;

    return {
      ok: true,
      pesan: `Berhasil mengimpor ${trxList.length} transaksi (${itemRows.length} item).`,
      jumlahTransaksi: trxList.length,
      jumlahItem: itemRows.length,
    };
  } catch (err: any) {
    return { ok: false, pesan: err?.message || "Gagal mengimpor file." };
  }
}
