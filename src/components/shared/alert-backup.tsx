"use client";

import { CloudDownload } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AlertBackup({
  onBackup,
  onTutup,
}: {
  onBackup: () => void;
  onTutup: () => void;
}) {
  return (
    <Alert variant="warning">
      <CloudDownload className="h-5 w-5" />
      <AlertTitle>Sudah backup data?</AlertTitle>
      <AlertDescription>
        <p>Amankan transaksi Anda ke Excel. Data tersimpan di server, tapi backup rutin menjaga ketenangan saat berpindah perangkat.</p>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" className="bg-warning text-white hover:bg-warning/90" onClick={onBackup}>
            Backup Sekarang
          </Button>
          <Button size="sm" variant="ghost" className="text-warning/80 hover:bg-warning/10 hover:text-warning" onClick={onTutup}>
            Nanti
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
