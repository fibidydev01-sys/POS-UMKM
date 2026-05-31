"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Gift, Pencil } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getAllPromoRule,
  tambahPromoRule,
  updatePromoRule,
  hapusPromoRule,
  type PromoRule,
  type PromoRuleInput,
} from "@/lib/db/promo-rule";
import { getMenuItems, type MenuItem } from "@/lib/db/menu";
import { cn } from "@/lib/utils";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormPromoRule } from "./form-promo-rule";

const TIPE_LABEL: Record<string, string> = {
  bogo: "Beli 1 Gratis 1",
  buy2get1: "Beli 2 Gratis 1",
};

export function PromoView() {
  const router = useRouter();
  const { umkmId, ownerId, isLoading: userLoading } = useCurrentUser(false);
  const [promos, setPromos] = React.useState<PromoRule[]>([]);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editPromo, setEditPromo] = React.useState<PromoRule | null>(null);
  const [deletePromo, setDeletePromo] = React.useState<PromoRule | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const reload = React.useCallback(async (id: string) => {
    const [p, m] = await Promise.all([getAllPromoRule(id), getMenuItems(id)]);
    setPromos(p);
    setMenuItems(m);
  }, []);

  React.useEffect(() => {
    if (userLoading || !umkmId) return;
    reload(umkmId).finally(() => setLoading(false));
  }, [umkmId, userLoading, reload]);

  const menuMap = React.useMemo(
    () => new Map(menuItems.map((m) => [m.id, m.nama])),
    [menuItems]
  );

  if (userLoading || loading) return <PageSkeleton variant="list" />;

  async function simpan(input: PromoRuleInput) {
    if (!umkmId || !ownerId) return;
    if (editPromo) {
      await updatePromoRule(
        editPromo.id,
        { berlaku_mulai: input.berlaku_mulai, berlaku_sampai: input.berlaku_sampai },
        ownerId
      );
    } else {
      await tambahPromoRule(umkmId, input, ownerId);
    }
    await reload(umkmId);
    toast.success(editPromo ? "Promo diperbarui" : "Promo ditambahkan");
  }

  async function confirmDelete() {
    if (!umkmId || !ownerId || !deletePromo) return;
    setDeleting(true);
    try {
      await hapusPromoRule(deletePromo.id, ownerId);
      await reload(umkmId);
      toast.success("Promo dihapus");
      setDeletePromo(null);
    } finally {
      setDeleting(false);
    }
  }

  const aktif = promos.filter((p) => p.is_active);
  const nonaktif = promos.filter((p) => !p.is_active);
  const kosong = aktif.length === 0 && nonaktif.length === 0;

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
        <Button
          size="sm"
          onClick={() => {
            setEditPromo(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </header>

      {kosong ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Gift className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">Belum ada promo</p>
          <p className="text-sm text-muted-foreground">
            Tambah promo BOGO untuk menarik pembeli.
          </p>
          <Button
            onClick={() => {
              setEditPromo(null);
              setFormOpen(true);
            }}
          >
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
              onEdit={() => {
                setEditPromo(p);
                setFormOpen(true);
              }}
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
                  onEdit={() => {
                    setEditPromo(p);
                    setFormOpen(true);
                  }}
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
        onHapus={editPromo ? () => setDeletePromo(editPromo) : undefined}
      />

      <ConfirmDialog
        open={!!deletePromo}
        onOpenChange={(o) => !o && setDeletePromo(null)}
        title="Hapus promo ini?"
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
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
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        (!promo.is_active || expired) && "opacity-50"
      )}
    >
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
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground"
        onClick={onEdit}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
