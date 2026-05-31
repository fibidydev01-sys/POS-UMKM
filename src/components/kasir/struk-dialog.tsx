"use client";

import type { UmkmConfig } from "@/lib/db/config";
import type { HasilTransaksi } from "@/lib/db/transaksi";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { StrukPrint } from "./struk-print";
import { CheckCircle2, Printer } from "lucide-react";

export function StrukDialog({
  struk,
  config,
  onClose,
}: {
  struk: HasilTransaksi | null;
  config: UmkmConfig | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!struk} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto flex max-h-[88dvh] flex-col sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Transaksi #{struk?.trx.nomor_order} berhasil
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 py-2">
            {struk && (
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-2">
                <StrukPrint config={config} trx={struk.trx} items={struk.items} />
              </div>
            )}
          </div>
        </ScrollArea>

        <DrawerFooter className="flex flex-row gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Transaksi Baru
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak Struk
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
