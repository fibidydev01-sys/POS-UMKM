"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Upload, Save, Tag, ChevronRight, Gift, QrCode } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { getConfig, updateProfil, type UmkmConfig } from "@/lib/db/config";
import { getPaperWidth, setPaperWidth } from "@/lib/utils/paper";
import { exportDanDownload } from "@/lib/export/excel";
import { importDariFile } from "@/lib/export/import";
import { features } from "@/lib/config/features";
import { cn } from "@/lib/utils";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function PengaturanView() {
  const { umkmId, isLoading: userLoading } = useCurrentUser(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [nama, setNama] = React.useState("");
  const [alamat, setAlamat] = React.useState("");
  const [telp, setTelp] = React.useState("");
  const [footer, setFooter] = React.useState("");
  const [lebar, setLebar] = React.useState<58 | 80>(58);

  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (userLoading || !umkmId) return;
    setLebar(getPaperWidth());
    getConfig(umkmId).then((c) => {
      setConfig(c);
      setNama(c?.nama_umkm ?? "");
      setAlamat(c?.alamat ?? "");
      setTelp(c?.no_telp ?? "");
      setFooter(c?.footer_struk ?? "");
      setLoading(false);
    });
  }, [umkmId, userLoading]);

  if (userLoading || loading) return <PageSkeleton variant="form" />;

  async function simpanProfil() {
    if (!umkmId || !nama.trim()) return;
    setSaving(true);
    try {
      await updateProfil(umkmId, { nama_umkm: nama, alamat, no_telp: telp, footer_struk: footer });
      toast.success("Profil tersimpan");
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  }

  function gantiLebar(w: 58 | 80) {
    setLebar(w);
    setPaperWidth(w);
    toast.success(`Lebar kertas ${w}mm tersimpan`);
  }

  async function ekspor() {
    if (!umkmId || busy) return;
    setBusy(true);
    try {
      const r = await exportDanDownload(umkmId, config);
      if (r.ok) {
        localStorage.setItem("last_backup_at", String(Date.now()));
        toast.success(r.pesan);
      } else {
        toast.error(r.pesan);
      }
    } finally {
      setBusy(false);
    }
  }

  function onFilePilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingFile(file);
  }

  async function confirmImport() {
    if (!pendingFile || !umkmId) return;
    setBusy(true);
    try {
      const r = await importDariFile(umkmId, pendingFile);
      if (r.ok) toast.success(r.pesan);
      else toast.error(r.pesan);
    } finally {
      setBusy(false);
      setPendingFile(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pengaturan</p>
        <h1 className="text-xl font-extrabold">Profil &amp; Data</h1>
      </header>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Profil Usaha</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nama">Nama usaha *</Label>
            <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alamat">Alamat</Label>
            <Input id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telp">No. telepon</Label>
            <Input id="telp" value={telp} onChange={(e) => setTelp(e.target.value)} inputMode="tel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="footer">Footer struk</Label>
            <Textarea id="footer" value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} />
          </div>
          <Button onClick={simpanProfil} disabled={!nama.trim() || saving}>
            <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Lebar Kertas Struk</CardTitle></CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={String(lebar)}
            onValueChange={(v) => v && gantiLebar(Number(v) as 58 | 80)}
            className="grid grid-cols-2 gap-3"
          >
            <ToggleGroupItem value="58" className="h-12 w-full justify-center font-bold">58 mm</ToggleGroupItem>
            <ToggleGroupItem value="80" className="h-12 w-full justify-center font-bold">80 mm</ToggleGroupItem>
          </ToggleGroup>
          <p className="mt-2 text-xs text-muted-foreground">Lebar mengikuti printer thermal Anda.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Preset Diskon</CardTitle></CardHeader>
        <CardContent>
          <NavLink href="/pengaturan/diskon" icon={<Tag className="h-5 w-5 text-primary" />} label="Kelola Preset Diskon" />
        </CardContent>
      </Card>

      {features.promoManagement && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">Program Promo</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">Setup BOGO dan promo quantity otomatis.</p>
            <NavLink href="/pengaturan/promo" icon={<Gift className="h-5 w-5 text-accent" />} label="Kelola Promo BOGO" />
          </CardContent>
        </Card>
      )}

      {features.pgConnector && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">Pembayaran QRIS</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Hubungkan Payment Gateway (Xendit / Midtrans / DOKU) milik Anda untuk terima QRIS.
            </p>
            <NavLink href="/pengaturan/pembayaran" icon={<QrCode className="h-5 w-5 text-primary" />} label="Setup Gateway QRIS" />
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Backup &amp; Restore</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Unduh data transaksi sebagai Excel.</p>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={ekspor}
            disabled={busy}
          >
            <Download className="h-4 w-4" /> {busy ? "Memproses..." : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" /> Import dari Backup
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFilePilih} />
          <p className="text-xs text-muted-foreground">Import bersifat <b>destruktif</b>.</p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingFile}
        onOpenChange={(o) => !o && setPendingFile(null)}
        title="Impor data transaksi?"
        description="Impor akan MENGGANTI seluruh data transaksi yang ada. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Impor & Ganti"
        destructive
        loading={busy}
        onConfirm={confirmImport}
      />
    </main>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/60")}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
