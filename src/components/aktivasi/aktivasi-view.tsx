"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store, KeyRound, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getUmkmId } from "@/lib/utils/umkm-id";
import { updateProfil } from "@/lib/db/config";

export function AktivasiView() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [kode, setKode] = React.useState("");
  const [umkmId, setUmkmId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [nama, setNama] = React.useState("");
  const [alamat, setAlamat] = React.useState("");
  const [telp, setTelp] = React.useState("");
  const [footer, setFooter] = React.useState("Terima kasih sudah berbelanja 🙏");

  async function aktivasi() {
    if (!kode.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/aktivasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode: kode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.pesan || "Aktivasi gagal.");
        return;
      }
      setUmkmId(data.umkmId);
      setStep(2);
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function simpanProfil() {
    const id = umkmId ?? getUmkmId();
    if (!id) {
      setError("Sesi tidak ditemukan, ulangi aktivasi.");
      setStep(1);
      return;
    }
    if (!nama.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      await updateProfil(id, {
        nama_umkm: nama,
        alamat,
        no_telp: telp,
        footer_struk: footer,
      });
      router.replace("/kasir");
    } catch {
      setError("Gagal menyimpan profil. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold">POS UMKM</h1>
          <p className="text-sm text-muted-foreground">
            {step === 1 ? "Masukkan kode aktivasi untuk mulai" : "Lengkapi profil usaha Anda"}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 1 ? (
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kode">Kode aktivasi</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="kode"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && aktivasi()}
                  placeholder="UMKM-XXXX-01"
                  className="pl-9 tracking-wider"
                  autoFocus
                  autoCapitalize="characters"
                />
              </div>
            </div>
            <Button size="lg" onClick={aktivasi} disabled={!kode.trim() || loading}>
              {loading ? "Memeriksa…" : "Aktivasi"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Belum punya kode? Hubungi penyedia layanan Anda.
            </p>
          </Card>
        ) : (
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nama">Nama usaha *</Label>
              <Input
                id="nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth. Kedai Kopi Senja"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alamat">Alamat</Label>
              <Input
                id="alamat"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telp">No. telepon</Label>
              <Input
                id="telp"
                value={telp}
                onChange={(e) => setTelp(e.target.value)}
                placeholder="Opsional"
                inputMode="tel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="footer">Footer struk</Label>
              <Textarea
                id="footer"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                rows={2}
              />
            </div>
            <Button size="lg" onClick={simpanProfil} disabled={!nama.trim() || loading}>
              {loading ? "Menyimpan…" : "Mulai Jualan"}
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}
