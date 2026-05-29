"use client";

import Link from "next/link";
import { CloudDownload, X } from "lucide-react";

export default function AlertBackup({ onTutup }: { onTutup?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 pr-2">
      <CloudDownload className="h-5 w-5 shrink-0 text-warning" />
      <p className="flex-1 text-sm text-warning">
        Sudah lama tidak backup. Amankan data Anda —{" "}
        <Link href="/pengaturan" className="font-bold underline underline-offset-2">
          export sekarang
        </Link>
        .
      </p>
      {onTutup && (
        <button
          onClick={onTutup}
          aria-label="Tutup"
          className="grid h-7 w-7 place-items-center rounded-full text-warning hover:bg-warning/15"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
