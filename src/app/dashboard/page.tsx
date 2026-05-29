"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId } from "@/lib/utils/umkm-id";
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
import { CalendarDays, CalendarRange } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [ringkasan, setRingkasan] = React.useState<RingkasanOmzet | null>(null);
  const [omzet7, setOmzet7] = React.useState<OmzetHarian[]>([]);
  const [top, setTop] = React.useState<TopProduk[]>([]);
  const [diskon, setDiskon] = React.useState<AnalisaDiskon[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [perluBackup, setPerluBackup] = React.useState(false);

  React.useEffect(() => {
    const id = getUmkmId();
    if (!id) {
      router.replace("/aktivasi");
      return;
    }
    (async () => {
      try {
        const [c, r, o, t, d] = await Promise.all([
          getConfig(id), getRingkasanOmzet(id), getOmzet7Hari(id), getTopProduk(id), getAnalisaDiskon(id),
        ]);
        setConfig(c);
        setRingkasan(r);
        setOmzet7(o);
        setTop(t);
        setDiskon(d);

        // Reminder backup (berdasarkan localStorage)
        const last = localStorage.getItem("last_backup_at");
        const lewat7Hari = !last || Date.now() - Number(last) > 7 * 24 * 60 * 60 * 1000;
        if (r.orderBulan > 0 && lewat7Hari) setPerluBackup(true);
      } finally {
        setLoading(false);
      }
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

      {/* Omzet hari ini */}
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
