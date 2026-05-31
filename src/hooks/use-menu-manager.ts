"use client";

import * as React from "react";
import {
  getMenuItems,
  getKategori,
  tambahMenuItem,
  updateMenuItem,
  hapusMenuItem,
  toggleTersedia,
  tambahKategori,
  hapusKategori,
  updateKategori,
  type MenuItem,
  type Kategori,
  type MenuItemInput,
} from "@/lib/db/menu";
import { useCurrentUser } from "./use-current-user";

export function useMenuManager() {
  const { umkmId, ownerId, isLoading: userLoading } = useCurrentUser(false);
  const [items, setItems] = React.useState<MenuItem[]>([]);
  const [kategori, setKategori] = React.useState<Kategori[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async (id: string) => {
    const [m, k] = await Promise.all([getMenuItems(id), getKategori(id)]);
    setItems(m);
    setKategori(k);
  }, []);

  React.useEffect(() => {
    if (userLoading || !umkmId) return;
    let alive = true;
    reload(umkmId).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [umkmId, userLoading, reload]);

  const simpanItem = React.useCallback(
    async (input: MenuItemInput, editId?: string) => {
      if (!umkmId || !ownerId) return;
      if (editId) await updateMenuItem(editId, input, ownerId);
      else await tambahMenuItem(umkmId, input, ownerId);
      await reload(umkmId);
    },
    [umkmId, ownerId, reload]
  );

  const hapusItem = React.useCallback(
    async (id: string) => {
      if (!umkmId || !ownerId) return;
      await hapusMenuItem(id, ownerId);
      await reload(umkmId);
    },
    [umkmId, ownerId, reload]
  );

  const onToggle = React.useCallback(
    async (item: MenuItem, isAvailable: boolean) => {
      if (!umkmId || !ownerId) return;
      // optimistic
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: isAvailable } : i))
      );
      try {
        await toggleTersedia(item.id, isAvailable, ownerId);
      } catch {
        // rollback bila gagal
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_available: !isAvailable } : i))
        );
        throw new Error("Gagal mengubah ketersediaan.");
      }
    },
    [umkmId, ownerId]
  );

  const tambahKat = React.useCallback(
    async (nama: string) => {
      if (!umkmId || !nama.trim()) return;
      await tambahKategori(umkmId, nama);
      await reload(umkmId);
    },
    [umkmId, reload]
  );

  const hapusKat = React.useCallback(
    async (id: string) => {
      if (!umkmId) return;
      await hapusKategori(id);
      await reload(umkmId);
    },
    [umkmId, reload]
  );

  const renameKat = React.useCallback(
    async (id: string, nama: string) => {
      if (!umkmId || !nama.trim()) return;
      await updateKategori(id, nama);
      await reload(umkmId);
    },
    [umkmId, reload]
  );

  return {
    items,
    kategori,
    isLoading: userLoading || loading,
    simpanItem,
    hapusItem,
    onToggle,
    tambahKat,
    hapusKat,
    renameKat,
  };
}
