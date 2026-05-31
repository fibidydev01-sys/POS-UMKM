"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/db/users";
import {
  getRingkasanOmzet, getTopProduk, getAnalisaDiskon,
  type RingkasanOmzet, type TopProduk, type AnalisaDiskon,
} from "@/lib/db/transaksi";
import { getOmzetDuaMinggu, type OmzetHari } from "@/lib/db/omzet-banding";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { formatRupiah } from "@/lib/utils/currency";
import { sapaan } from "@/lib/utils/date";
import StatCard from "@/components/dashboard/stat-card";
import ChartOmzet from "@/components/dashboard/chart-omzet";
import { TopProdukList, AnalisaDiskonList } from "@/components/dashboard/top-diskon";
import AlertBackup from "@/components/shared/alert-backup";
import { CalendarDays, CalendarRange, RotateCcw, Gift } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [ringkasan, setRingkasan] = React.useState<RingkasanOmzet | null>(null);
  const [omzetIni, setOmzetIni] = React.useState<OmzetHari[]>([]);
  const [omzetLalu, setOmzetLalu] = React.useState<OmzetHari[]>([]);
  const [top, setTop] = React.useState<TopProduk[]>([]);
  const [diskon, setDiskon] = React.useState<AnalisaDiskon[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tutupBackup, setTutupBackup] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace("/aktivasi"); return; }

      const [c, r, banding, t, d] = await Promise.all([
        getConfig(u.umkm_id),
        getRingkasanOmzet(u.umkm_id),
        getOmzetDuaMinggu(u.umkm_id),
        getTopProduk(u.umkm_id),
        getAnalisaDiskon(u.umkm_id),
      ]);
      setConfig(c);
      setRingkasan(r);
      setOmzetIni(banding.ini);
      setOmzetLalu(banding.lalu);
      setTop(t);
      setDiskon(d);
      setLoading(false);
    })();
  }, [router]);

  if (loading || !ringkasan) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat statistik…</div>;
  }

  const adaRefund = ringkasan.jumlahRefundBulan > 0;
  const adaBogo = ringkasan.jumlahItemGratisBulan > 0;
  const perluBackup = !tutupBackup && ringkasan.omzetBulan > 0 && ringkasan.orderBulan >= 10;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-sm text-muted-foreground">{sapaan()},</p>
        <h1 className="text-xl font-extrabold">{config?.nama_umkm || "Juragan"}</h1>
      </header>

      <div className="mb-3">
        <StatCard
          label="OMZET HARI INI"
          nilai={formatRupiah(ringkasan.omzetHariIni)}
          sub={`${ringkasan.orderHariIni} transaksi hari ini`}
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
          sub={`${ringkasan.orderBulan} order`}
          icon={<CalendarRange className="h-4 w-4" />}
        />
      </div>

      {(adaRefund || adaBogo) && (
        <div className="mb-4 flex gap-3">
          {adaRefund && (
            <div className="flex-1">
              <StatCard
                label="Refund bulan ini"
                nilai={formatRupiah(ringkasan.refundBulan)}
                sub={`${ringkasan.jumlahRefundBulan} transaksi`}
                icon={<RotateCcw className="h-4 w-4" />}
              />
            </div>
          )}
          {adaBogo && (
            <div className="flex-1">
              <StatCard
                label="Nilai BOGO bulan ini"
                nilai={formatRupiah(ringkasan.nilaiBogoBulan)}
                sub={`${ringkasan.jumlahItemGratisBulan} item digratiskan`}
                icon={<Gift className="h-4 w-4" />}
              />
            </div>
          )}
        </div>
      )}

      {perluBackup && (
        <div className="mb-4">
          <AlertBackup onBackup={() => router.push("/pengaturan")} onTutup={() => setTutupBackup(true)} />
        </div>
      )}

      <div className="mb-4">
        <ChartOmzet data={omzetIni} dataLalu={omzetLalu} />
      </div>

      <div className="mb-4">
        <TopProdukList data={top} />
      </div>

      <AnalisaDiskonList data={diskon} />
    </main>
  );
}
