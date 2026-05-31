"use client";

import * as XLSX from "xlsx";
import { supabase } from "../supabase/client";
import { BACKUP_SHEET_NAME, BACKUP_HEADERS } from "./excel";

export interface HasilImport { ok: boolean; pesan: string; jumlahTransaksi?: number; jumlahItem?: number; }

interface BackupExcelRow {
  transaksi_id?: unknown; nomor_order?: unknown; created_at?: unknown; status?: unknown;
  payment_method?: unknown; grand_total?: unknown; uang_diterima?: unknown; kembalian?: unknown;
  kasir_id?: unknown; diskon_preset_id?: unknown; item_id?: unknown; menu_item_id?: unknown;
  nama_produk?: unknown; harga_satuan?: unknown; qty?: unknown; item_type?: unknown;
  diskon_persen?: unknown; diskon_preset_id_item?: unknown; final_price_item?: unknown;
  [key: string]: unknown;
}

interface TransaksiInsert {
  id: string; umkm_id: string; nomor_order: string; created_at: string; status: string;
  payment_method: string; grand_total: number; uang_diterima: number | null;
  kembalian: number | null; kasir_id: string; diskon_preset_id: string | null;
}

interface ItemInsert {
  id: string; transaksi_id: string; umkm_id: string; menu_item_id: string | null;
  nama_produk: string; harga_satuan: number; qty: number; item_type: string;
  diskon_persen: number; diskon_preset_id: string | null; triggered_by_item_id: null;
  final_price_item: number;
}

export async function importDariFile(umkmId: string, file: File): Promise<HasilImport> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[BACKUP_SHEET_NAME];
    if (!ws) return { ok: false, pesan: `Sheet "${BACKUP_SHEET_NAME}" tidak ditemukan di file ini.` };

    const rows = XLSX.utils.sheet_to_json<BackupExcelRow>(ws, { defval: "" });
    if (rows.length === 0) return { ok: false, pesan: "Sheet backup kosong." };

    const cols = Object.keys(rows[0]);
    const wajib = (BACKUP_HEADERS as readonly string[]).filter((h) => !cols.includes(h));
    if (wajib.length > 0) return { ok: false, pesan: `Kolom backup tidak lengkap: ${wajib.join(", ")}` };

    const trxMap = new Map<string, TransaksiInsert>();
    const itemRows: ItemInsert[] = [];

    for (const r of rows) {
      const tid = String(r.transaksi_id || "").trim();
      if (!tid) continue;
      if (!trxMap.has(tid)) {
        trxMap.set(tid, {
          id: tid, umkm_id: umkmId, nomor_order: String(r.nomor_order || ""),
          created_at: new Date(String(r.created_at)).toISOString(), status: String(r.status || "completed"),
          payment_method: String(r.payment_method || "cash"), grand_total: Number(r.grand_total) || 0,
          uang_diterima: r.uang_diterima !== "" ? Number(r.uang_diterima) : null,
          kembalian: r.kembalian !== "" ? Number(r.kembalian) : null,
          kasir_id: String(r.kasir_id || ""), diskon_preset_id: r.diskon_preset_id ? String(r.diskon_preset_id) : null,
        });
      }
      itemRows.push({
        id: String(r.item_id || ""), transaksi_id: tid, umkm_id: umkmId,
        menu_item_id: r.menu_item_id ? String(r.menu_item_id) : null, nama_produk: String(r.nama_produk || ""),
        harga_satuan: Number(r.harga_satuan) || 0, qty: Number(r.qty) || 0,
        item_type: String(r.item_type || "normal"), diskon_persen: Number(r.diskon_persen) || 0,
        diskon_preset_id: r.diskon_preset_id_item ? String(r.diskon_preset_id_item) : null,
        triggered_by_item_id: null, final_price_item: Number(r.final_price_item) || 0,
      });
    }

    const trxList = [...trxMap.values()];
    const { data: userRow } = await supabase.from("users").select("id").eq("umkm_id", umkmId).eq("role", "owner").single();
    if (!userRow) return { ok: false, pesan: "System user tidak ditemukan. Coba re-aktivasi kode." };

    const validKasirId = userRow.id;
    for (const t of trxList) t.kasir_id = validKasirId;

    const del = await supabase.from("transaksi").delete().eq("umkm_id", umkmId);
    if (del.error) throw del.error;

    const insTrx = await supabase.from("transaksi").insert(trxList);
    if (insTrx.error) throw insTrx.error;

    const insItems = await supabase.from("transaction_items").insert(itemRows);
    if (insItems.error) throw insItems.error;

    return { ok: true, pesan: `Berhasil mengimpor ${trxList.length} transaksi (${itemRows.length} item).`, jumlahTransaksi: trxList.length, jumlahItem: itemRows.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengimpor file.";
    return { ok: false, pesan: message };
  }
}
