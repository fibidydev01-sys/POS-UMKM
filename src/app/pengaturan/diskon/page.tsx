"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId, getOwnerId } from "@/lib/utils/umkm-id";
import {
  getAllDiskonPreset, tambahDiskonPreset, updateDiskonPreset, hapusDiskonPreset,
  type DiskonPreset, type DiskonPresetInput,
} from "@/lib/db/diskon-preset";
import FormDiskonPreset from "@/components/pengaturan/form-diskon-preset";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DiskonPresetPage() {
  const router = useRouter();
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [ownerId, setOwnerId] = React.useState<string | null>(null);
  const [presets, setPresets] = React.useState<DiskonPreset[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editPreset, setEditPreset] = React.useState<DiskonPreset | null>(null);

  const reload = React.useCallback(async (id: string) => {
    const data = await getAllDiskonPreset(id);
    setPresets(data);
  }, []);

  React.useEffect(() => {
    const id = getUmkmId();
    const oId = getOwnerId();
    if (!id) {
      router.replace("/aktivasi");
      return;
    }
    setUmkmId(id);
    setOwnerId(oId);
    reload(id).finally(() => setLoading(false));
  }, [router, reload]);

  async function simpan(input: DiskonPresetInput) {
    if (!umkmId || !ownerId) return;
    if (editPreset) {
      await updateDiskonPreset(editPreset.id, input, ownerId);
    } else {
      await tambahDiskonPreset(umkmId, input, ownerId);
    }
    await reload(umkmId);
  }

  async function hapus() {
    if (!umkmId || !ownerId || !editPreset) return;
    await hapusDiskonPreset(editPreset.id, ownerId);
    await reload(umkmId);
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Memuat preset diskon…
      </div>
    );
  }

  const aktif = presets.filter((p) => p.is_active);
  const nonaktif = presets.filter((p) => !p.is_active);

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

      {/* Preset aktif */}
      {aktif.length === 0 && nonaktif.length === 0 ? (
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
              <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
        onHapus={editPreset ? hapus : undefined}
      />
    </main>
  );
}

function PresetRow({
  preset,
  onEdit,
}: {
  preset: DiskonPreset;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3",
        !preset.is_active && "opacity-50"
      )}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {preset.persen}%
      </div>
      <div className="flex-1">
        <p className="font-semibold">{preset.nama}</p>
        {!preset.is_active && (
          <p className="text-xs text-muted-foreground">Nonaktif</p>
        )}
      </div>
      <button
        onClick={onEdit}
        aria-label="Edit"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
