"use client";

import * as React from "react";
import type { Kategori, MenuItem, MenuItemInput } from "@/lib/db/menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatAngka, parseRupiah } from "@/lib/utils/currency";
import {
  Trash2,
  ChevronRight,
  Tag,
  ArrowLeft,
  Plus,
  X,
  Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerView = "form" | "kelola";

interface ViewState {
  current: DrawerView;
  prev: DrawerView | null;
}

const VIEW_ORDER: DrawerView[] = ["kelola", "form"];

// ─── Main component ───────────────────────────────────────────────────────────

export function FormMenuItem({
  open,
  onOpenChange,
  kategori,
  item,
  initialView = "form",
  onSimpan,
  onHapus,
  onTambahKategori,
  onRenameKat,
  onHapusKat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategori: Kategori[];
  item: MenuItem | null;
  initialView?: "form" | "kelola";
  onSimpan: (input: MenuItemInput) => Promise<void> | void;
  onHapus?: () => void;
  onTambahKategori?: (nama: string) => Promise<void>;
  onRenameKat?: (id: string, nama: string) => Promise<void>;
  onHapusKat?: (id: string) => Promise<void>;
}) {
  // ── Form state ──
  const [nama, setNama] = React.useState("");
  const [harga, setHarga] = React.useState("");
  const [kategoriId, setKategoriId] = React.useState<string | null>(null);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // ── View state ──
  const [viewState, setViewState] = React.useState<ViewState>({
    current: "form",
    prev: null,
  });

  // ── Kelola state ──
  const [katBaru, setKatBaru] = React.useState("");
  const [addingKat, setAddingKat] = React.useState(false);
  const [showTambahKat, setShowTambahKat] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<Kategori | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // ── Reset on open ──
  React.useEffect(() => {
    if (open) {
      setNama(item?.nama ?? "");
      setHarga(item ? formatAngka(item.harga) : "");
      setKategoriId(item?.kategori_id ?? null);
      setIsAvailable(item?.is_available ?? true);
      setViewState({
        current: initialView,
        prev: initialView !== "form" ? "form" : null,
      });
      setKatBaru("");
      setShowTambahKat(false);
      setRenameTarget(null);
    }
  }, [open, item, initialView]);

  // ── Navigation ──
  function goTo(view: DrawerView) {
    setViewState((s) => ({ current: view, prev: s.current }));
  }
  function goBack() {
    setViewState((s) => ({ current: s.prev ?? "form", prev: null }));
  }

  // ── Derived ──
  const valid = nama.trim().length > 0 && parseRupiah(harga) > 0;
  const namaKatTerpilih =
    kategori.find((k) => k.id === kategoriId)?.nama ?? "Tanpa kategori";

  const headerTitle: Record<DrawerView, string> = {
    form: item ? "Edit Menu" : "Tambah Menu",
    kelola: "Pilih Kategori",
  };

  const isForm = viewState.current === "form";
  const isBack = viewState.current !== "form";
  const slideIdx = VIEW_ORDER.indexOf(viewState.current);

  // ── Handlers ──
  async function simpan() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSimpan({
        nama,
        harga: parseRupiah(harga),
        kategori_id: kategoriId,
        is_available: isAvailable,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleTambahKat() {
    if (!katBaru.trim() || addingKat) return;
    setAddingKat(true);
    try {
      await onTambahKategori?.(katBaru.trim());
      setKatBaru("");
      setShowTambahKat(false);
    } finally {
      setAddingKat(false);
    }
  }

  async function handleRename(k: Kategori) {
    if (!renameValue.trim() || renamingId) return;
    setRenamingId(k.id);
    try {
      await onRenameKat?.(k.id, renameValue.trim());
      setRenameTarget(null);
      setRenameValue("");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleHapusKat(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onHapusKat?.(id);
      if (kategoriId === id) setKategoriId(null);
    } finally {
      setDeletingId(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/*
        ── Strategi tinggi ─────────────────────────────────────────────────
        DrawerContent dikunci ke h-[92dvh] (bukan max-h) supaya tingginya
        selalu fixed tidak peduli view mana yang aktif atau ada-tidaknya footer.
        Layout di dalam: flex-col dengan tiga baris:
          1. Header   — shrink-0
          2. Body     — flex-1 overflow-hidden  (slide area)
          3. Footer   — shrink-0, visibility:hidden di view kelola
                        (hidden menyembunyikan visual tapi tetap occupies space
                         sehingga body tidak melebar dan drawer tidak resize)
      */}
      <DrawerContent className="mx-auto flex h-[92dvh] flex-col sm:max-w-lg">

        {/* ── 1. Header ── */}
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4">
          <DrawerTitle className="sr-only">
            {headerTitle[viewState.current]}
          </DrawerTitle>

          <button
            type="button"
            onClick={goBack}
            aria-label="Kembali"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
              isBack
                ? "h-8 w-8 opacity-100 pointer-events-auto"
                : "h-8 w-0 opacity-0 pointer-events-none overflow-hidden"
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(calc(-${slideIdx} * 100%))` }}
            >
              {VIEW_ORDER.map((v) => (
                <p
                  key={v}
                  className="w-full shrink-0 text-center text-base font-bold"
                  style={{ minWidth: "100%" }}
                >
                  {headerTitle[v]}
                </p>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "shrink-0 transition-all duration-200",
              isBack ? "w-8" : "w-0 overflow-hidden"
            )}
          />
        </div>

        {/* ── 2. Body — slide area ── */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out will-change-transform"
            style={{ transform: `translateX(calc(-${slideIdx} * 100%))` }}
          >

            {/* ── PANEL 0: Kelola Kategori ── */}
            <div className="h-full w-full shrink-0 overflow-hidden" style={{ minWidth: "100%" }}>
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-1.5 px-4 pb-4 pt-1">

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setKategoriId(null); goBack(); }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (setKategoriId(null), goBack())
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-xl border px-3 py-2 cursor-pointer transition-colors select-none",
                      kategoriId === null
                        ? "border-accent/30 bg-accent/10"
                        : "border-border bg-card hover:bg-secondary/60"
                    )}
                  >
                    <span className={cn(
                      "flex-1 truncate text-sm font-semibold",
                      kategoriId === null ? "text-accent" : ""
                    )}>
                      Tanpa kategori
                    </span>
                  </div>

                  {kategori.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada kategori.
                    </p>
                  ) : (
                    kategori.map((k) => (
                      <div key={k.id}>
                        {renameTarget?.id === k.id ? (
                          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2">
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(k);
                                if (e.key === "Escape") { setRenameTarget(null); setRenameValue(""); }
                              }}
                              className="h-8 flex-1 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleRename(k)}
                              disabled={!renameValue.trim() || renamingId === k.id}
                              className="h-8 shrink-0 px-3 text-xs"
                            >
                              {renamingId === k.id ? "..." : "Simpan"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setRenameTarget(null); setRenameValue(""); }}
                              className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className={cn(
                            "flex items-center gap-1 rounded-xl border px-3 py-2 transition-colors",
                            kategoriId === k.id
                              ? "border-accent/30 bg-accent/10"
                              : "border-border bg-card"
                          )}>
                            <button
                              type="button"
                              onClick={() => { setKategoriId(k.id); goBack(); }}
                              className={cn(
                                "flex-1 truncate text-left text-sm font-semibold py-1",
                                kategoriId === k.id ? "text-accent" : ""
                              )}
                            >
                              {k.nama}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRenameTarget(k); setRenameValue(k.nama); }}
                              aria-label={`Ubah nama ${k.nama}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHapusKat(k.id)}
                              disabled={deletingId === k.id}
                              aria-label={`Hapus ${k.nama}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {showTambahKat ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                      <Input
                        value={katBaru}
                        onChange={(e) => setKatBaru(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTambahKat();
                          if (e.key === "Escape") { setShowTambahKat(false); setKatBaru(""); }
                        }}
                        placeholder="Nama kategori"
                        className="h-8 flex-1 text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleTambahKat}
                        disabled={!katBaru.trim() || addingKat}
                        className="h-8 shrink-0 px-3 text-xs"
                      >
                        {addingKat ? "..." : "Simpan"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setShowTambahKat(false); setKatBaru(""); }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTambahKat(true)}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah kategori
                    </button>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* ── PANEL 1: Form Menu ── */}
            <div className="h-full w-full shrink-0 overflow-hidden" style={{ minWidth: "100%" }}>
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nama">Nama produk</Label>
                    <Input
                      id="nama"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="cth. Kopi Tubruk"
                      autoFocus={isForm}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="harga">Harga</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="harga"
                        inputMode="numeric"
                        value={harga}
                        onChange={(e) =>
                          setHarga(formatAngka(parseRupiah(e.target.value)))
                        }
                        placeholder="0"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Kategori</Label>
                    <button
                      type="button"
                      onClick={() => goTo("kelola")}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
                        kategoriId
                          ? "border-accent/30 bg-accent/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/70"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className={cn("h-4 w-4", kategoriId ? "text-accent" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-semibold", kategoriId ? "text-accent" : "text-muted-foreground")}>
                          {namaKatTerpilih}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                    <div>
                      <span className="text-sm font-semibold">Tersedia dijual hari ini</span>
                      <p className="text-xs text-muted-foreground">
                        Bisa di-toggle kapan saja jika stok habis
                      </p>
                    </div>
                    <Switch
                      checked={isAvailable}
                      onCheckedChange={setIsAvailable}
                      aria-label="Tersedia hari ini"
                    />
                  </div>

                  {item && onHapus && (
                    <Button
                      variant="ghost"
                      className="mt-1 w-full justify-center text-destructive hover:bg-destructive/10"
                      onClick={() => { onOpenChange(false); onHapus(); }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus menu ini
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </div>

          </div>
        </div>

        {/* ── 3. Footer ──────────────────────────────────────────────────────
          visibility:hidden di view kelola → tidak tampil, TIDAK bisa diklik,
          tapi tetap occupy space sehingga h-[92dvh] terbagi sama persis di
          kedua view dan drawer shell tidak bergeser sama sekali.
          Berbeda dengan display:none yang menghilangkan space-nya.
        ──────────────────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 border-t border-border bg-card px-4 pb-6 pt-3"
          style={{ visibility: isForm ? "visible" : "hidden" }}
          aria-hidden={!isForm}
        >
          <Button
            className="w-full"
            onClick={simpan}
            disabled={!valid || saving}
            tabIndex={isForm ? 0 : -1}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>

      </DrawerContent>
    </Drawer>
  );
}