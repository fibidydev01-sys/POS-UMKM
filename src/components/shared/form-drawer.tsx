"use client";

import * as React from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function FormDrawer({
  open, onOpenChange, title, headerRight, children,
  onSimpan, simpanLabel = "Simpan", saving = false, canSave = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  onSimpan: () => void;
  simpanLabel?: string;
  saving?: boolean;
  canSave?: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex max-h-[88dvh] flex-col sm:max-w-lg">
        <DrawerHeader className="flex flex-row items-center justify-between gap-3">
          <DrawerTitle>{title}</DrawerTitle>
          {headerRight}
        </DrawerHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 py-3">{children}</div>
        </ScrollArea>

        <DrawerFooter className="flex flex-row justify-end">
          <Button onClick={onSimpan} disabled={!canSave || saving} className="min-w-28">
            {saving ? "Menyimpan..." : simpanLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
