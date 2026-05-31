"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Tag } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getAllDiskonPreset,
  tambahDiskonPreset,
  updateDiskonPreset,
  hapusDiskonPreset,
  type DiskonPreset,
  type DiskonPresetInput,
} from "@/lib/db/diskon-preset";
import { cn } from "@/lib/utils";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormDiskonPreset } from "./form-diskon-preset";

export function DiskonPresetView() {
  const router = useRouter();
  const { umkmId, ownerId, isLoading: userLoading } = useCurrentUser(false);
  const [presets, setPresets] = React.useState<DiskonPreset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editPreset, setEditPreset] = React.useState<DiskonPreset | null>(null);
  const [deletePreset, setDeletePreset] = React.useState<DiskonPreset | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const reload = React.useCallback(async (id: string) => {
    setPresets(await getAllDiskonPreset(id));
  }, []);

  React.useEffect(() => {
    if (userLoading || !umkmId) return;
    reload(umkmId).finally(() => setLoading(false));
  }, [umkmId, userLoading, reload]);

  if (userLoading || loading) return <PageSkeleton variant="list" />;

  async function simpan(input: DiskonPresetInput) {
    if (!umkmId || !ownerId) return;
    if (editPreset) await updateDiskonPreset(editPreset.id, input, ownerId);
    else await tambahDiskonPreset(umkmId, input, ownerId);
    await reload(umkmId);
    toast.success(editPreset ? "Preset diperbarui" : "Preset ditambahkan");
  }

  async function confirmDelete() {
    if (!umkmId || !ownerId || !deletePreset) return;
    setDeleting(true);
    try {
      await hapusDiskonPreset(deletePreset.id, ownerId);
      await reload(umkmId);
      toast.success(`Preset "${deletePreset.nama}" dihapus`);
      setDeletePreset(null);
    } finally {
      setDeleting(false);
    }
  }

  const aktif = presets.filter((p) => p.is_active);
  const nonaktif = presets.filter((p) => !p.is_active);
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
          <h1 className="text-xl font-extrabold">Preset Diskon</h1>
          <p className="text-sm text-muted-foreground">
            Kasir hanya bisa pilih dari preset ini. Tidak ada input bebas.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditPreset(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </header>

      {kosong ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Tag className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">Belum ada preset diskon</p>
          <p className="text-sm text-muted-foreground">
            Tambah preset agar kasir bisa pilih diskon saat transaksi.
          </p>
          <Button
            onClick={() => {
              setEditPreset(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tambah Preset Pertama
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {aktif.map((p) => (
            <PresetRow
              key={p.id}
              preset={p}
              onEdit={() => {
                setEditPreset(p);
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
                <PresetRow
                  key={p.id}
                  preset={p}
                  onEdit={() => {
                    setEditPreset(p);
                    setFormOpen(true);
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      <FormDiskonPreset
        open={formOpen}
        onOpenChange={setFormOpen}
        preset={editPreset}
        onSimpan={simpan}
        onHapus={editPreset ? () => setDeletePreset(editPreset) : undefined}
      />

      <ConfirmDialog
        open={!!deletePreset}
        onOpenChange={(o) => !o && setDeletePreset(null)}
        title={deletePreset ? `Hapus preset "${deletePreset.nama}"?` : ""}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </main>
  );
}

function PresetRow({ preset, onEdit }: { preset: DiskonPreset; onEdit: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        !preset.is_active && "opacity-50"
      )}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {preset.persen}%
      </div>
      <div className="flex-1">
        <p className="font-semibold">{preset.nama}</p>
        {!preset.is_active && <p className="text-xs text-muted-foreground">Nonaktif</p>}
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
