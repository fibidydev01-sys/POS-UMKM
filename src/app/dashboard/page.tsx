"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/db/users";
import {
  getRingkasanOmzet, getOmzet7Hari, getTopProduk, getAnalisaDiskon,
  type RingkasanOmzet, type OmzetHarian, type TopProduk, type AnalisaDiskon,
} from "@/lib/db/transaksi";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { formatRupiah } from "@/lib/utils/currency";
import { sapaan } from "@/lib/utils/date";
import StatCard from "@/components/dashboard/stat-card";
import ChartOmzet from "@/components/dashboard/chart-omzet";
import { TopProdukList, AnalisaDiskonList } from "@/components/dashboard/top-diskon";
import AlertBackup from "@/components/shared/alert-backup";
import { CalendarDays, CalendarRange, RotateCcw } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [ringkasan, setRingkasan] = React.useState<RingkasanOmzet | null>(null);
  const [omzet7, setOmzet7] = React.useState<OmzetHarian[]>([]);
  const [top, setTop] = React.useState<TopProduk[]>([]);
  const [diskon, setDiskon] = React.useState<AnalisaDiskon[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [perluBackup, setPerluBackup] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace("/aktivasi"); return; }
      setUser(u);

      const [c, r, o, t, d] = await Promise.all([
        getConfig(u.umkm_id),
        getRingkasanOmzet(u.umkm_id),
        getOmzet7Hari(u.umkm_id),
        getTopProduk(u.umkm_id),
        getAnalisaDiskon(u.umkm_id),
      ]);
      setConfig(c);
      setRingkasan(r);
      setOmzet7(o);
      setTop(t);
      setDiskon(d);

      const last = localStorage.getItem("last_backup_at");
      const lewat7Hari = !last || Date.now() - Number(last) > 7 * 24 * 60 * 60 * 1000;
      if (r.orderBulan > 0 && lewat7Hari) setPerluBackup(true);
      setLoading(false);
    })();
  }, [router]);

  if (loading || !ringkasan) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat statistik…</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-sm text-muted-foreground">{sapaan()},</p>
        <h1 className="text-xl font-extrabold">{config?.nama_umkm || "Pemilik UMKM"}</h1>
      </header>

      {perluBackup && (
        <div className="mb-4">
          <AlertBackup onTutup={() => setPerluBackup(false)} />
        </div>
      )}

      <div className="mb-3">
        <StatCard
          label="OMZET HARI INI"
          nilai={formatRupiah(ringkasan.omzetHariIni)}
          sub={`${ringkasan.orderHariIni} transaksi`}
          highlight
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Minggu ini"
          nilai={formatRupiah(ringkasan.omzetMinggu)}
          sub={`${ringkasan.orderMinggu} transaksi`}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          label="Bulan ini"
          nilai={formatRupiah(ringkasan.omzetBulan)}
          sub={`${ringkasan.orderBulan} transaksi`}
          icon={<CalendarRange className="h-4 w-4" />}
        />
      </div>

      {ringkasan.jumlahRefundBulan > 0 && (
        <div className="mb-4">
          <StatCard
            label="Refund bulan ini"
            nilai={formatRupiah(ringkasan.refundBulan)}
            sub={`${ringkasan.jumlahRefundBulan} transaksi direfund`}
            icon={<RotateCcw className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="mb-4">
        <ChartOmzet data={omzet7} />
      </div>

      <div className="mb-4">
        <TopProdukList data={top} />
      </div>

      <AnalisaDiskonList data={diskon} />
    </main>
  );
}
