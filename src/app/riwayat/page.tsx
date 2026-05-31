"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/db/users";
import {
  getRiwayat, getItemsByTransaksi, voidTransaksi, refundTransaksi,
  type Transaksi, type TransactionItem,
} from "@/lib/db/transaksi";
import { getConfig, type UmkmConfig } from "@/lib/db/config";
import { formatRupiah } from "@/lib/utils/currency";
import { formatJam, formatTanggalPanjang, jakartaDateStr } from "@/lib/utils/date";
import { features } from "@/lib/config/features";
import StrukPrint from "@/components/kasir/struk-print";
import EmptyState from "@/components/shared/empty-state";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, ChevronRight, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  completed: "Selesai",
  void:      "VOID",
  refund:    "REFUND",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-success/10 text-success",
  void:      "bg-destructive/10 text-destructive",
  refund:    "bg-warning/10 text-warning",
};

export default function RiwayatPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [list, setList] = React.useState<Transaksi[]>([]);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [selected, setSelected] = React.useState<Transaksi | null>(null);
  const [selItems, setSelItems] = React.useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);

  const [voidLoading, setVoidLoading] = React.useState(false);
  const [refundLoading, setRefundLoading] = React.useState(false);
  const [alasanRefund, setAlasanRefund] = React.useState("");
  const [showRefundForm, setShowRefundForm] = React.useState(false);

  const reload = React.useCallback(async (umkmId: string) => {
    const [t, c] = await Promise.all([getRiwayat(umkmId), getConfig(umkmId)]);
    setList(t);
    setConfig(c);
  }, []);

  React.useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace("/aktivasi"); return; }
      setUser(u);
      await reload(u.umkm_id);
      setLoading(false);
    })();
  }, [router, reload]);

  async function buka(t: Transaksi) {
    setSelected(t);
    setShowRefundForm(false);
    setAlasanRefund("");
    setLoadingItems(true);
    try { setSelItems(await getItemsByTransaksi(t.id)); }
    finally { setLoadingItems(false); }
  }

  async function handleVoid() {
    if (!user || !selected) return;
    if (!window.confirm(`Void transaksi #${selected.nomor_order}? Tidak bisa dibatalkan.`)) return;
    setVoidLoading(true);
    try {
      await voidTransaksi(selected.id, user.id);
      setSelected(null);
      await reload(user.umkm_id);
    } catch { alert("Gagal void."); }
    finally { setVoidLoading(false); }
  }

  async function handleRefund() {
    if (!user || !selected || !alasanRefund.trim()) return;
    setRefundLoading(true);
    try {
      await refundTransaksi(selected.id, user.id, alasanRefund.trim());
      setSelected(null);
      await reload(user.umkm_id);
    } catch { alert("Gagal refund."); }
    finally { setRefundLoading(false); }
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
        <EmptyState icon="🧾" judul="Belum ada transaksi" deskripsi="Transaksi yang dibuat akan muncul di sini." />
      ) : (
        <div className="flex flex-col gap-1">
          {list.map((t) => {
            const ds = jakartaDateStr(t.created_at);
            const showHeader = ds !== lastDate;
            lastDate = ds;
            const isVoidOrRefund = t.status !== "completed";
            return (
              <React.Fragment key={t.id}>
                {showHeader && (
                  <p className="mb-1 mt-3 px-1 text-xs font-bold text-muted-foreground">
                    {formatTanggalPanjang(t.created_at)}
                  </p>
                )}
                <button
                  onClick={() => buka(t)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-secondary/40",
                    isVoidOrRefund ? "border-border opacity-60" : "border-border"
                  )}
                >
                  <div className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold",
                    isVoidOrRefund ? "bg-muted text-muted-foreground" : "bg-secondary"
                  )}>
                    #{t.nomor_order.split("-")[1] ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-bold", isVoidOrRefund && "line-through text-muted-foreground")}>
                        {formatRupiah(t.grand_total)}
                      </p>
                      {isVoidOrRefund && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLOR[t.status])}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatJam(t.created_at)} · {t.payment_method === "cash" ? "Tunai" : t.payment_method.toUpperCase()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setShowRefundForm(false); } }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detail #{selected?.nomor_order}
            {selected && selected.status !== "completed" && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_COLOR[selected.status])}>
                {STATUS_LABEL[selected.status]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loadingItems ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : selected && (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-2">
            <StrukPrint config={config} trx={selected} items={selItems} />
          </div>
        )}

        {selected?.void_reason && (
          <p className={cn("mt-2 rounded-lg px-3 py-2 text-xs", STATUS_COLOR[selected.status])}>
            {selected.status === "refund" ? "Alasan refund" : "Alasan void"}: {selected.void_reason}
          </p>
        )}

        {/* Form refund — hanya V2 mode + transaksi completed */}
        {features.refund && showRefundForm && selected?.status === "completed" && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-semibold">Alasan refund (wajib)</p>
            <Input
              value={alasanRefund}
              onChange={(e) => setAlasanRefund(e.target.value)}
              placeholder="cth. Pelanggan komplain, salah item"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRefundForm(false)}>Batal</Button>
              <Button
                className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
                disabled={!alasanRefund.trim() || refundLoading}
                onClick={handleRefund}
              >
                {refundLoading ? "Memproses…" : "Konfirmasi Refund"}
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons — transaksi completed, form refund tidak tampil */}
        {!showRefundForm && selected?.status === "completed" && (
          <div className="mt-5 flex gap-2 print:hidden">
            {/* Void — selalu ada di V1 dan Final */}
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={handleVoid}
              disabled={voidLoading}
            >
              <XCircle className="h-4 w-4" />
              {voidLoading ? "…" : "Void"}
            </Button>

            {/* Refund — hanya V2 mode */}
            {features.refund && (
              <Button
                variant="ghost"
                className="text-warning hover:bg-warning/10"
                onClick={() => setShowRefundForm(true)}
              >
                <RotateCcw className="h-4 w-4" /> Refund
              </Button>
            )}

            <Button className="flex-1" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak Ulang
            </Button>
          </div>
        )}

        {/* Void/refund sudah — hanya cetak */}
        {!showRefundForm && selected?.status !== "completed" && (
          <div className="mt-5 print:hidden">
            <Button className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak Ulang
            </Button>
          </div>
        )}
      </Dialog>
    </main>
  );
}
