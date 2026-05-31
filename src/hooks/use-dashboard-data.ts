"use client";

import * as React from "react";
import { getRingkasanOmzet, getTopProduk, getAnalisaDiskon, type RingkasanOmzet, type TopProduk, type AnalisaDiskon } from "@/lib/db/transaksi";
import { getOmzetDuaMinggu, type OmzetHari } from "@/lib/db/omzet-banding";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { useCurrentUser } from "./use-current-user";

interface DashboardData {
  config: UmkmConfig | null;
  ringkasan: RingkasanOmzet;
  omzetIni: OmzetHari[];
  omzetLalu: OmzetHari[];
  top: TopProduk[];
  diskon: AnalisaDiskon[];
}

export function useDashboardData() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (userLoading || !user) return;
    let alive = true;
    (async () => {
      const [c, r, banding, t, d] = await Promise.all([
        getConfig(user.umkm_id), getRingkasanOmzet(user.umkm_id),
        getOmzetDuaMinggu(user.umkm_id), getTopProduk(user.umkm_id), getAnalisaDiskon(user.umkm_id),
      ]);
      if (!alive) return;
      setData({ config: c, ringkasan: r, omzetIni: banding.ini, omzetLalu: banding.lalu, top: t, diskon: d });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, userLoading]);

  return { data, isLoading: userLoading || loading };
}
