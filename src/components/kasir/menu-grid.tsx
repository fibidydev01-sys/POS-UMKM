"use client";

import type { MenuItem } from "@/lib/db/menu";
import { MenuCard, type MenuLayout } from "./menu-card";

export function MenuGrid({
  items,
  qtyMap,
  layout,
  onTambah,
}: {
  items: MenuItem[];
  qtyMap: Record<string, number>;
  layout: MenuLayout;
  onTambah: (item: MenuItem) => void;
}) {
  const className =
    layout === "list"
      ? "flex flex-col gap-2"
      : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={className}>
      {items.map((item) => (
        <MenuCard
          key={item.id}
          item={item}
          qty={qtyMap[item.id] ?? 0}
          layout={layout}
          onTambah={onTambah}
        />
      ))}
    </div>
  );
}
