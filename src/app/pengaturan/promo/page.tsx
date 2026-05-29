"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId, getOwnerId } from "@/lib/utils/umkm-id";
import {
  getAllPromoRule, tambahPromoRule, updatePromoRule, hapusPromoRule,
  type PromoRule, type PromoRuleInput,
} from "@/lib/db/promo-rule";
import { getMenuItems, type MenuItem } from "@/lib/db/menu";
import FormPromoRule from "@/components/pengaturan/form-promo-rule";
import { Button } from "@/components/ui/button";
import { Plus, Gift, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPE_LABEL: Record<string, string> = {
  bogo: "Beli 1 Gratis 1",
  buy2get1: "Beli 2 Gratis 1",
};

export default function PromoPage() {
  const router = useRouter();
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [ownerId, setOwnerId] = React.useState<string | null>(null);
  const [promos, setPromos] = React.useState<PromoRule[]>([]);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editPromo, setEditPromo] = React.useState<PromoRule | null>(null);

  const reload = React.useCallback(async (id: string) => {
    const [p, m] = await Promise.all([getAllPromoRule(id), getMenuItems(id)]);
    setPromos(p);
    setMenuItems(m);
  }, []);

  React.useEffect(() => {
    const id = getUmkmId();
    const oId = getOwnerId();
    if (!id) { router.replace("/aktivasi"); return; }
    setUmkmId(id);
    setOwnerId(oId);
    reload(id).finally(() => setLoading(false));
  }, [router, reload]);

  const menuMap = React.useMemo(
    () => new Map(menuItems.map((m) => [m.id, m.nama])),
    [menuItems]
  );

  async function simpan(input: PromoRuleInput) {
    if (!umkmId || !ownerId) return;
    if (editPromo) {
      await updatePromoRule(editPromo.id, {
        berlaku_mulai: input.berlaku_mulai,
        berlaku_sampai: input.berlaku_sampai,
      }, ownerId);
    } else {
      await tambahPromoRule(umkmId, input, ownerId);
    }
    await reload(umkmId);
  }

  async function hapus() {
    if (!ownerId || !editPromo) return;
    await hapusPromoRule(editPromo.id, ownerId);
    await reload(umkmId!);
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat…</div>;
  }

  const aktif = promos.filter((p) => p.is_active);
  const nonaktif = promos.filter((p) => !p.is_active);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            ← Pengaturan
          </button>
          <h1 className="text-xl font-extrabold">Program Promo</h1>
          <p className="text-sm text-muted-foreground">
            Promo BOGO otomatis terpicu saat item ditambah ke keranjang.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditPromo(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </header>

      {aktif.length === 0 && nonaktif.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Gift className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">Belum ada promo</p>
          <p className="text-sm text-muted-foreground">
            Tambah promo BOGO untuk menarik pembeli.
          </p>
          <Button onClick={() => { setEditPromo(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Tambah Promo Pertama
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {aktif.map((p) => (
            <PromoRow
              key={p.id}
              promo={p}
              namaItem={menuMap.get(p.menu_item_id)}
              onEdit={() => { setEditPromo(p); setFormOpen(true); }}
            />
          ))}
          {nonaktif.length > 0 && (
            <>
              <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nonaktif
              </p>
              {nonaktif.map((p) => (
                <PromoRow
                  key={p.id}
                  promo={p}
                  namaItem={menuMap.get(p.menu_item_id)}
                  onEdit={() => { setEditPromo(p); setFormOpen(true); }}
                />
              ))}
            </>
          )}
        </div>
      )}

      <FormPromoRule
        open={formOpen}
        onOpenChange={setFormOpen}
        promo={editPromo}
        menuItems={menuItems}
        onSimpan={simpan}
        onHapus={editPromo ? hapus : undefined}
      />
    </main>
  );
}

function PromoRow({
  promo,
  namaItem,
  onEdit,
}: {
  promo: PromoRule;
  namaItem?: string;
  onEdit: () => void;
}) {
  const now = new Date();
  const sampai = promo.berlaku_sampai ? new Date(promo.berlaku_sampai) : null;
  const expired = sampai && sampai < now;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border bg-card p-3",
      (!promo.is_active || expired) && "opacity-50"
    )}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10">
        <Gift className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1">
        <p className="font-semibold">{namaItem ?? "Item tidak dikenal"}</p>
        <p className="text-xs text-muted-foreground">
          {TIPE_LABEL[promo.tipe_promo] ?? promo.tipe_promo}
          {expired && " · Expired"}
          {!promo.is_active && !expired && " · Nonaktif"}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
