"use client";

import { CloudDownload } from "lucide-react";

export default function AlertBackup({
  onBackup,
  onTutup,
}: {
  onBackup: () => void;
  onTutup: () => void;
}) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center gap-2">
        <CloudDownload className="h-5 w-5 shrink-0 text-warning" />
        <p className="font-bold text-warning">Sudah backup data?</p>
      </div>
      <p className="mt-1 text-sm text-warning/90">
        Amankan transaksi Anda ke Excel. Data tersimpan di server, tapi backup rutin
        menjaga ketenangan saat berpindah perangkat.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onBackup}
          className="rounded-lg bg-warning px-4 py-1.5 text-sm font-bold text-white"
        >
          Backup Sekarang
        </button>
        <button
          onClick={onTutup}
          className="px-2 py-1.5 text-sm font-bold text-warning/80 hover:text-warning"
        >
          Nanti
        </button>
      </div>
    </div>
  );
}
