"use client";

import type { UmkmConfig } from "@/lib/db/config";
import type { Transaksi, TransactionItem } from "@/lib/db/transaksi";
import { formatRupiah, formatAngka } from "@/lib/utils/currency";
import { formatTanggalJam } from "@/lib/utils/date";

/**
 * Struk dibungkus elemen id="area-struk".
 * CSS @media print (globals.css) hanya menampilkan elemen ini saat dicetak.
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
  const garis = "border-t border-dashed border-black my-1";
  return (
    <div
      id="area-struk"
      className="mx-auto w-[58mm] bg-white px-1 py-2 font-mono text-[11px] leading-tight text-black"
    >
      <div className="text-center">
        <p className="text-sm font-bold uppercase">{config?.nama_umkm || "UMKM"}</p>
        {config?.alamat && <p className="text-[10px]">{config.alamat}</p>}
        {config?.no_telp && <p className="text-[10px]">{config.no_telp}</p>}
      </div>

      <div className={garis} />

      <div className="flex justify-between">
        <span>No #{trx.nomor_order}</span>
        <span>{trx.metode_bayar}</span>
      </div>
      <div className="text-[10px]">{formatTanggalJam(trx.timestamp)}</div>

      <div className={garis} />

      {items.map((it) => (
        <div key={it.id} className="mb-1">
          <div>{it.nama_produk}</div>
          <div className="flex justify-between">
            <span>
              {it.qty} x {formatAngka(it.harga_satuan)}
            </span>
            <span>{formatAngka(it.subtotal_item)}</span>
          </div>
          {it.diskon_nominal > 0 && (
            <div className="flex justify-between">
              <span>diskon {it.diskon_persen}%</span>
              <span>-{formatAngka(it.diskon_nominal)}</span>
            </div>
          )}
        </div>
      ))}

      <div className={garis} />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatAngka(trx.subtotal)}</span>
      </div>
      {trx.diskon_nominal > 0 && (
        <div className="flex justify-between">
          <span>Diskon {trx.diskon_persen}%</span>
          <span>-{formatAngka(trx.diskon_nominal)}</span>
        </div>
      )}
      <div className="mt-0.5 flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatRupiah(trx.grand_total)}</span>
      </div>

      <div className={garis} />

      <div className="whitespace-pre-line text-center text-[10px]">
        {config?.footer_struk || "Terima kasih 🙏"}
      </div>
    </div>
  );
}
