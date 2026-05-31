"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, RotateCcw, Gift } from "lucide-react";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatRupiah } from "@/lib/utils/currency";
import { sapaan } from "@/lib/utils/date";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { StatCard } from "./stat-card";
import ChartOmzet from "./chart-omzet";
import { TopProdukList, AnalisaDiskonList } from "./top-diskon";
import AlertBackup from "@/components/shared/alert-backup";

export function DashboardView() {
  const router = useRouter();
  const { data, isLoading } = useDashboardData();
  const [tutupBackup, setTutupBackup] = React.useState(false);

  if (isLoading || !data) return <PageSkeleton variant="dashboard" />;

  const { config, ringkasan, omzetIni, omzetLalu, top, diskon } = data;
  const adaRefund = ringkasan.jumlahRefundBulan > 0;
  const adaBogo = ringkasan.jumlahItemGratisBulan > 0;
  const perluBackup =
    !tutupBackup && ringkasan.omzetBulan > 0 && ringkasan.orderBulan >= 10;

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
          <AlertBackup
            onBackup={() => router.push("/pengaturan")}
            onTutup={() => setTutupBackup(true)}
          />
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
