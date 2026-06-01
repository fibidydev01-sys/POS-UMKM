"use client";

import * as XLSX from "xlsx";
import { supabase } from "../supabase/client";
import type { UmkmConfig } from "../db/config";
import type { Transaksi, TransactionItem } from "../db/transaksi";
import { formatAngka } from "../utils/currency";
import { formatTanggal, formatTanggalJam, formatBulanTahun } from "../utils/date";

export const BACKUP_SHEET_NAME = "BACKUP_DATA";

// [FIX B4] triggered_by_item_id ditambahkan di akhir. Tanpa kolom ini, item
// promo_free saat di-import kehilangan parent → melanggar CHECK
// (promo_free wajib triggered_by_item_id NOT NULL) → seluruh import gagal.
export const BACKUP_HEADERS = [
  "transaksi_id", "nomor_order", "created_at", "status", "payment_method",
  "grand_total", "uang_diterima", "kembalian", "kasir_id", "diskon_preset_id",
  "item_id", "menu_item_id", "nama_produk", "harga_satuan", "qty",
  "item_type", "diskon_persen", "diskon_preset_id_item", "final_price_item",
  "triggered_by_item_id",
] as const;

export interface HasilExport { ok: boolean; pesan: string; jumlahBaris?: number; }

type BackupRow = (string | number | null)[];

export async function exportDanDownload(umkmId: string, config: UmkmConfig | null): Promise<HasilExport> {
  try {
    const [{ data: trxData, error: e1 }, { data: itemData, error: e2 }] = await Promise.all([
      supabase.from("transaksi").select("*").eq("umkm_id", umkmId).order("created_at", { ascending: true }),
      supabase.from("transaction_items").select("*").eq("umkm_id", umkmId),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const transaksi = (trxData ?? []) as Transaksi[];
    const items = (itemData ?? []) as TransactionItem[];

    if (transaksi.length === 0) return { ok: false, pesan: "Belum ada transaksi untuk diekspor." };

    const itemsByTrx = new Map<string, TransactionItem[]>();
    for (const it of items) {
      const arr = itemsByTrx.get(it.transaksi_id) ?? [];
      arr.push(it);
      itemsByTrx.set(it.transaksi_id, arr);
    }

    const namaUmkm = config?.nama_umkm || "UMKM";
    const wb = XLSX.utils.book_new();

    const aoa: (string | number)[][] = [];
    aoa.push(["Nama UMKM", namaUmkm]);
    aoa.push(["Periode", formatBulanTahun(new Date())]);
    aoa.push(["Dicetak", formatTanggalJam(new Date())]);
    aoa.push([]);
    aoa.push(["Tgl", "No", "Status", "Bayar", "Produk", "Qty", "Harga", "Final"]);

    let totalOmzet = 0;
    let totalVoid = 0;

    for (const t of transaksi) {
      const its = itemsByTrx.get(t.id) ?? [];
      its.forEach((it, idx) => {
        aoa.push([
          idx === 0 ? formatTanggal(t.created_at) : "",
          idx === 0 ? t.nomor_order : "",
          idx === 0 ? t.status.toUpperCase() : "",
          idx === 0 ? (t.payment_method === "cash" ? "Tunai" : t.payment_method.toUpperCase()) : "",
          it.nama_produk, it.qty, formatAngka(it.harga_satuan), formatAngka(it.final_price_item),
        ]);
      });
      aoa.push(["", "", "", "", "TOTAL", "", "", formatAngka(t.grand_total)]);
      aoa.push([]);
      if (t.status === "completed") totalOmzet += t.grand_total;
      else totalVoid += t.grand_total;
    }

    aoa.push([]);
    aoa.push(["SUMMARY"]);
    aoa.push(["Total Transaksi (completed)", transaksi.filter((t) => t.status === "completed").length]);
    aoa.push(["Total Omzet", `Rp ${formatAngka(totalOmzet)}`]);
    aoa.push(["Total Void", `Rp ${formatAngka(totalVoid)}`]);

    const ws1 = XLSX.utils.aoa_to_sheet(aoa);
    ws1["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 6 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Laporan");

    const backup: BackupRow[] = [[...BACKUP_HEADERS]];
    let jumlahBaris = 0;

    for (const t of transaksi) {
      const its = itemsByTrx.get(t.id) ?? [];
      for (const it of its) {
        backup.push([
          t.id, t.nomor_order, t.created_at, t.status, t.payment_method,
          t.grand_total, t.uang_diterima ?? "", t.kembalian ?? "", t.kasir_id, t.diskon_preset_id ?? "",
          it.id, it.menu_item_id ?? "", it.nama_produk, it.harga_satuan, it.qty,
          it.item_type, it.diskon_persen, it.diskon_preset_id ?? "", it.final_price_item,
          it.triggered_by_item_id ?? "",
        ]);
        jumlahBaris++;
      }
    }

    const ws2 = XLSX.utils.aoa_to_sheet(backup);
    XLSX.utils.book_append_sheet(wb, ws2, BACKUP_SHEET_NAME);

    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const tgl = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    a.href = url;
    a.download = `Backup-${namaUmkm.replace(/[^\w-]+/g, "_")}-${tgl}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { ok: true, pesan: `Berhasil mengekspor ${jumlahBaris} baris.`, jumlahBaris };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengekspor data.";
    return { ok: false, pesan: message };
  }
}
