"use client";

import * as React from "react";
import type { UmkmConfig } from "@/lib/db/config";
import type { Transaksi, TransactionItem } from "@/lib/db/transaksi";
import { formatRupiah, formatAngka } from "@/lib/utils/currency";
import { formatTanggalJam } from "@/lib/utils/date";
import { getPaperWidth } from "@/lib/utils/paper";
import { cn } from "@/lib/utils";

/**
 * Struk dibungkus elemen id="area-struk".
 * CSS @media print (globals.css) hanya menampilkan elemen ini saat dicetak.
 *
 * Lebar kertas (58mm / 80mm) mengikuti preferensi perangkat (localStorage),
 * dan ukuran @page disuntik dinamis ke <head> agar pratinjau cetak sesuai.
 */
export default function StrukPrint({
  config,
  trx,
  items,
}: {
  config: UmkmConfig | null;
  trx: Transaksi;
  items: TransactionItem[];
}) {
  // Lebar kertas = preferensi perangkat (localStorage). Default 58mm.
  const [paperWidth, setPaperWidth] = React.useState<58 | 80>(58);
  React.useEffect(() => { setPaperWidth(getPaperWidth()); }, []);

  // Suntik @page size sesuai lebar kertas (hanya berlaku saat cetak).
  React.useEffect(() => {
    const id = "struk-page-size";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `@media print{@page{margin:4mm;size:${paperWidth}mm auto}}`;
    return () => { el?.remove(); };
  }, [paperWidth]);

  const garis = "border-t border-dashed border-black my-1";

  // Hitung diskon dari items untuk tampilan struk
  // Diskon header = selisih (subtotal sebelum diskon - grand_total)
  const subtotalSebelumDiskon = items.reduce(
    (s, it) => s + it.harga_satuan * it.qty,
    0
  );
  const totalDiskon = subtotalSebelumDiskon - trx.grand_total;
  const diskonPersen = items.find((it) => it.item_type === "discounted")?.diskon_persen ?? 0;

  const labelPayment: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
    debit: "Debit",
  };

  const lebar80 = paperWidth === 80;

  return (
    <div
      id="area-struk"
      className={cn(
        "mx-auto bg-white px-1 py-2 font-mono leading-tight text-black",
        lebar80 ? "w-[80mm] text-[12px]" : "w-[58mm] text-[11px]"
      )}
    >
      {/* Header UMKM */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase">{config?.nama_umkm || "UMKM"}</p>
        {config?.alamat && <p className="text-[10px]">{config.alamat}</p>}
        {config?.no_telp && <p className="text-[10px]">{config.no_telp}</p>}
      </div>

      <div className={garis} />

      {/* Info transaksi */}
      <div className="flex justify-between">
        <span>No #{trx.nomor_order}</span>
        <span>{labelPayment[trx.payment_method] ?? trx.payment_method}</span>
      </div>
      <div className="text-[10px]">{formatTanggalJam(trx.created_at)}</div>

      {trx.status === "void" && (
        <div className="my-1 text-center font-bold">*** VOID ***</div>
      )}

      <div className={garis} />

      {/* Daftar item */}
      {items.map((it) => (
        <div key={it.id} className="mb-1">
          <div>{it.nama_produk}</div>
          <div className="flex justify-between">
            <span>
              {it.qty} x {formatAngka(it.harga_satuan)}
            </span>
            <span>{formatAngka(it.harga_satuan * it.qty)}</span>
          </div>
        </div>
      ))}

      <div className={garis} />

      {/* Total */}
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatAngka(subtotalSebelumDiskon)}</span>
      </div>
      {totalDiskon > 0 && (
        <div className="flex justify-between">
          <span>Diskon {diskonPersen}%</span>
          <span>-{formatAngka(totalDiskon)}</span>
        </div>
      )}
      <div className="mt-0.5 flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatRupiah(trx.grand_total)}</span>
      </div>

      {/* Kembalian — hanya untuk cash */}
      {trx.payment_method === "cash" && trx.uang_diterima !== null && (
        <>
          <div className={garis} />
          <div className="flex justify-between">
            <span>Bayar</span>
            <span>{formatAngka(trx.uang_diterima)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Kembalian</span>
            <span>{formatAngka(trx.kembalian ?? 0)}</span>
          </div>
        </>
      )}

      <div className={garis} />

      {/* Footer */}
      <div className="whitespace-pre-line text-center text-[10px]">
        {config?.footer_struk || "Terima kasih 🙏"}
      </div>
    </div>
  );
}
