"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId } from "@/lib/utils/umkm-id";
import {
  getRiwayat, getItemsByTransaksi, hapusTransaksi,
  type Transaksi, type TransactionItem,
} from "@/lib/db/transaksi";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { formatRupiah } from "@/lib/utils/currency";
import { formatJam, formatTanggalPanjang, jakartaDateStr } from "@/lib/utils/date";
import StrukPrint from "@/components/kasir/struk-print";
import EmptyState from "@/components/shared/empty-state";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Trash2, ChevronRight } from "lucide-react";

export default function RiwayatPage() {
  const router = useRouter();
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [list, setList] = React.useState<Transaksi[]>([]);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [selected, setSelected] = React.useState<Transaksi | null>(null);
  const [selItems, setSelItems] = React.useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [hapusLoading, setHapusLoading] = React.useState(false);

  const reload = React.useCallback(async (id: string) => {
    const [t, c] = await Promise.all([getRiwayat(id), getConfig(id)]);
    setList(t);
    setConfig(c);
  }, []);

  React.useEffect(() => {
    const id = getUmkmId();
    if (!id) {
      router.replace("/aktivasi");
      return;
    }
    setUmkmId(id);
    reload(id).finally(() => setLoading(false));
  }, [router, reload]);

  async function buka(t: Transaksi) {
    setSelected(t);
    setLoadingItems(true);
    try {
      setSelItems(await getItemsByTransaksi(t.id));
    } finally {
      setLoadingItems(false);
    }
  }

  async function hapus() {
    if (!umkmId || !selected) return;
    if (!window.confirm(`Hapus transaksi #${selected.nomor_order}? Tindakan ini permanen.`)) return;
    setHapusLoading(true);
    try {
      await hapusTransaksi(selected.id);
      setSelected(null);
      await reload(umkmId);
    } finally {
      setHapusLoading(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat riwayat…</div>;
  }

  let lastDate = "";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan</p>
        <h1 className="text-xl font-extrabold">Riwayat Transaksi</h1>
      </header>

      {list.length === 0 ? (
        <EmptyState icon="🧾" judul="Belum ada transaksi" deskripsi="Transaksi yang Anda buat akan muncul di sini." />
      ) : (
        <div className="flex flex-col gap-1">
          {list.map((t) => {
            const ds = jakartaDateStr(t.timestamp);
            const tampilkanHeader = ds !== lastDate;
            lastDate = ds;
            return (
              <React.Fragment key={t.id}>
                {tampilkanHeader && (
                  <p className="mt-3 mb-1 px-1 text-xs font-bold text-muted-foreground">
                    {formatTanggalPanjang(t.timestamp)}
                  </p>
                )}
                <button
                  onClick={() => buka(t)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold">
                    #{t.nomor_order}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{formatRupiah(t.grand_total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatJam(t.timestamp)}
                      {t.diskon_nominal > 0 && ` · diskon ${t.diskon_persen}%`}
                      {t.catatan ? ` · ${t.catatan}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogHeader>
          <DialogTitle>Detail Transaksi #{selected?.nomor_order}</DialogTitle>
        </DialogHeader>

        {loadingItems ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : (
          selected && (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-2">
              <StrukPrint config={config} trx={selected} items={selItems} />
            </div>
          )
        )}

        <div className="mt-5 flex gap-2 print:hidden">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={hapus}
            disabled={hapusLoading}
          >
            <Trash2 className="h-4 w-4" /> {hapusLoading ? "Menghapus…" : "Hapus"}
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak Ulang
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
