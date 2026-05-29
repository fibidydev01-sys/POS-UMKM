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
 * void seluruh transaksi UMKM ini, lalu isi ulang dari Sheet "BACKUP_DATA".
 *
 * CATATAN: import tidak bisa membuat ulang transaksi dengan id yang sama
 * karena trigger grand_total akan memvalidasi ulang. Ini adalah restore
 * dari backup yang dihasilkan oleh export yang sama.
 */
export async function importDariFile(umkmId: string, file: File): Promise<HasilImport> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[BACKUP_SHEET_NAME];
    if (!ws) {
      return {
        ok: false,
        pesan: `Sheet "${BACKUP_SHEET_NAME}" tidak ditemukan di file ini.`,
      };
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    if (rows.length === 0) return { ok: false, pesan: "Sheet backup kosong." };

    // Validasi header — cek kolom wajib ada
    const cols = Object.keys(rows[0]);
    const wajib = (BACKUP_HEADERS as readonly string[]).filter((h) => !cols.includes(h));
    if (wajib.length > 0) {
      return {
        ok: false,
        pesan: `Kolom backup tidak lengkap: ${wajib.join(", ")}`,
      };
    }

    // Kelompokkan per transaksi
    const trxMap = new Map<string, any>();
    const itemRows: any[] = [];

    for (const r of rows) {
      const tid = String(r.transaksi_id || "").trim();
      if (!tid) continue;

      if (!trxMap.has(tid)) {
        const paymentMethod = String(r.payment_method || "cash");
        const grandTotal = Number(r.grand_total) || 0;
        const uangDiterima = r.uang_diterima !== "" ? Number(r.uang_diterima) : null;
        const kembalian = r.kembalian !== "" ? Number(r.kembalian) : null;

        trxMap.set(tid, {
          id: tid,
          umkm_id: umkmId,
          nomor_order: String(r.nomor_order || ""),
          created_at: new Date(r.created_at).toISOString(),
          status: String(r.status || "completed"),
          payment_method: paymentMethod,
          grand_total: grandTotal,
          uang_diterima: uangDiterima,
          kembalian: kembalian,
          kasir_id: String(r.kasir_id || ""),
          diskon_preset_id: r.diskon_preset_id || null,
        });
      }

      const itemType = String(r.item_type || "normal");
      itemRows.push({
        id: String(r.item_id || ""),
        transaksi_id: tid,
        umkm_id: umkmId,
        menu_item_id: r.menu_item_id || null,
        nama_produk: String(r.nama_produk || ""),
        harga_satuan: Number(r.harga_satuan) || 0,
        qty: Number(r.qty) || 0,
        item_type: itemType,
        diskon_persen: Number(r.diskon_persen) || 0,
        diskon_preset_id: r.diskon_preset_id_item || null,
        triggered_by_item_id: null, // V1: selalu null
        final_price_item: Number(r.final_price_item) || 0,
      });
    }

    const trxList = [...trxMap.values()];

    // Validasi kasir_id — harus ada user dengan id itu
    // Ambil system user untuk UMKM ini
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("umkm_id", umkmId)
      .eq("role", "owner")
      .single();

    if (!userRow) {
      return { ok: false, pesan: "System user tidak ditemukan. Coba re-aktivasi kode." };
    }

    // Ganti kasir_id dengan system user yang valid untuk UMKM ini
    // (kasir_id dari backup mungkin dari instalasi berbeda)
    const validKasirId = userRow.id;
    for (const t of trxList) {
      t.kasir_id = validKasirId;
    }

    // 1) Hapus data lama UMKM ini
    // transaction_items terhapus via ON DELETE CASCADE di transaksi
    const del = await supabase.from("transaksi").delete().eq("umkm_id", umkmId);
    if (del.error) throw del.error;

    // 2) Insert transaksi dengan id eksplisit (untuk menjaga relasi dengan items)
    const insTrx = await supabase.from("transaksi").insert(trxList);
    if (insTrx.error) throw insTrx.error;

    // 3) Insert items
    // Trigger check_grand_total akan validasi otomatis
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
