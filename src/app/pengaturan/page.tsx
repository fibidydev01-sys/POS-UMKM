"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getUmkmId } from "@/lib/utils/umkm-id";
import { getConfig, updateProfil, type UmkmConfig } from "@/lib/db/config";
import { exportDanDownload } from "@/lib/export/excel";
import { importDariFile } from "@/lib/export/import";
import { features } from "@/lib/config/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Save, CheckCircle2, AlertCircle, Tag, ChevronRight, Gift } from "lucide-react";
import Link from "next/link";

type Pesan = { tipe: "ok" | "err"; teks: string } | null;

export default function PengaturanPage() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<UmkmConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [nama, setNama] = React.useState("");
  const [alamat, setAlamat] = React.useState("");
  const [telp, setTelp] = React.useState("");
  const [footer, setFooter] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pesan, setPesan] = React.useState<Pesan>(null);

  React.useEffect(() => {
    const id = getUmkmId();
    if (!id) { router.replace("/aktivasi"); return; }
    setUmkmId(id);

    getConfig(id).then((c) => {
      setConfig(c);
      setNama(c?.nama_umkm ?? "");
      setAlamat(c?.alamat ?? "");
      setTelp(c?.no_telp ?? "");
      setFooter(c?.footer_struk ?? "");
      setLoading(false);
    });
  }, [router]);

  function flash(p: Pesan) { setPesan(p); if (p) setTimeout(() => setPesan(null), 4000); }

  async function simpanProfil() {
    if (!umkmId || !nama.trim()) return;
    setSaving(true);
    try {
      await updateProfil(umkmId, { nama_umkm: nama, alamat, no_telp: telp, footer_struk: footer });
      flash({ tipe: "ok", teks: "Profil tersimpan." });
    } catch { flash({ tipe: "err", teks: "Gagal menyimpan profil." }); }
    finally { setSaving(false); }
  }

  async function ekspor() {
    if (!umkmId || busy) return;
    setBusy(true);
    try {
      const r = await exportDanDownload(umkmId, config);
      if (r.ok) { localStorage.setItem("last_backup_at", String(Date.now())); flash({ tipe: "ok", teks: r.pesan }); }
      else flash({ tipe: "err", teks: r.pesan });
    } finally { setBusy(false); }
  }

  async function onFilePilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !umkmId) return;
    if (!window.confirm("Impor akan MENGGANTI seluruh data transaksi. Lanjutkan?")) return;
    setBusy(true);
    try {
      const r = await importDariFile(umkmId, file);
      flash({ tipe: r.ok ? "ok" : "err", teks: r.pesan });
    } finally { setBusy(false); }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Memuat…</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pengaturan</p>
        <h1 className="text-xl font-extrabold">Profil &amp; Data</h1>
      </header>

      {pesan && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          pesan.tipe === "ok"
            ? "border-success/30 bg-success/10 text-success"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        }`}>
          {pesan.tipe === "ok"
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {pesan.teks}
        </div>
      )}

      {/* Profil Usaha */}
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
            <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan Profil"}
          </Button>
        </CardContent>
      </Card>

      {/* Preset Diskon — aktif di V1 dan V2 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Preset Diskon</CardTitle></CardHeader>
        <CardContent>
          <NavLink
            href="/pengaturan/diskon"
            icon={<Tag className="h-5 w-5 text-primary" />}
            label="Kelola Preset Diskon"
          />
        </CardContent>
      </Card>

      {/* Program Promo — hanya V2 (BOGO belum aktif di V1) */}
      {features.promoManagement && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">Program Promo</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">Setup BOGO dan promo quantity otomatis.</p>
            <NavLink
              href="/pengaturan/promo"
              icon={<Gift className="h-5 w-5 text-accent" />}
              label="Kelola Promo BOGO"
            />
          </CardContent>
        </Card>
      )}

      {/* Backup & Restore */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Backup &amp; Restore</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Unduh data transaksi sebagai Excel.</p>
          <Button variant="accent" onClick={ekspor} disabled={busy}>
            <Download className="h-4 w-4" /> {busy ? "Memproses…" : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" /> Import dari Backup
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFilePilih} />
          <p className="text-xs text-muted-foreground">⚠️ Import bersifat <b>destruktif</b>.</p>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Informasi</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <Baris label="Versi aplikasi" nilai={config?.app_version || "v1"} />
        </CardContent>
      </Card>
    </main>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 hover:bg-secondary/60 transition-colors"
    >
      <div className="flex items-center gap-3">{icon}<span className="font-semibold">{label}</span></div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold capitalize">{nilai}</span>
    </div>
  );
}
