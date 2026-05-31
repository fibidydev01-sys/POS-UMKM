"use client";

import * as React from "react";
import {
  getRiwayat, getItemsByTransaksi, voidTransaksi, refundTransaksi,
  type Transaksi, type TransactionItem,
} from "@/lib/db/transaksi";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { useCurrentUser } from "./use-current-user";

export function useRiwayat() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [list, setList] = React.useState<Transaksi[]>([]);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async (umkmId: string) => {
    const [t, c] = await Promise.all([getRiwayat(umkmId), getConfig(umkmId)]);
    setList(t);
    setConfig(c);
  }, []);

  React.useEffect(() => {
    if (userLoading || !user) return;
    let alive = true;
    (async () => {
      await reload(user.umkm_id);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, userLoading, reload]);

  const fetchItems = React.useCallback((transaksiId: string) => getItemsByTransaksi(transaksiId), []);

  const doVoid = React.useCallback(async (id: string) => {
    if (!user) return;
    await voidTransaksi(id, user.id);
    await reload(user.umkm_id);
  }, [user, reload]);

  const doRefund = React.useCallback(async (id: string, alasan: string) => {
    if (!user) return;
    await refundTransaksi(id, user.id, alasan);
    await reload(user.umkm_id);
  }, [user, reload]);

  return { list, config, isLoading: userLoading || loading, fetchItems, doVoid, doRefund };
}

export type { Transaksi, TransactionItem };
