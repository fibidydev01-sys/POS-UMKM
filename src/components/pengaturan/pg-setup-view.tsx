"use client";

// ⚠️ Komponen BARU. Import primitive UI mengikuti pola shadcn/ui umum proyek ini.
//    Samakan path/nama bila berbeda (Card, Button, Input, Label, Select). Logika tetap.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

type Provider = "xendit" | "midtrans" | "doku";
type Mode = "sandbox" | "production";

interface CredentialMeta {
  provider: Provider;
  mode: Mode;
  is_active: boolean;
  has_webhook_token: boolean;
  updated_at: string;
}

interface ProviderCfg {
  id: Provider;
  label: string;
  keyHint: string;
  tokenLabel?: string;
  tokenHint?: string;
}

const PROVIDERS: ProviderCfg[] = [
  {
    id: "xendit",
    label: "Xendit",
    keyHint: "Secret Key (xnd_production_… / xnd_development_…)",
    tokenLabel: "Webhook Callback Token",
    tokenHint: "Token verifikasi callback dari Dashboard Xendit (Settings → Webhooks).",
  },
  {
    id: "midtrans",
    label: "Midtrans",
    keyHint: "Server Key (Mid-server-…)",
  },
  {
    id: "doku",
    label: "DOKU",
    keyHint: "ClientId:ClientSecret (dipisah titik dua)",
    tokenLabel: "RSA Private Key (base64 PEM)",
    tokenHint:
      "DOKU SNAP butuh private key RSA untuk B2B token. Tempel base64 dari file PEM. Uji di sandbox dulu.",
  },
];

export function PgSetupView() {
  const [provider, setProvider] = useState<Provider>("xendit");
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [mode, setMode] = useState<Mode>("sandbox");

  const [meta, setMeta] = useState<CredentialMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const current = PROVIDERS.find((p) => p.id === provider)!;
  const savedActive = meta.find((m) => m.is_active) ?? null;
  const savedForProvider = meta.find((m) => m.provider === provider) ?? null;

  async function loadMeta() {
    setLoading(true);
    try {
      const res = await fetch("/api/payment/credentials");
      const data = await res.json();
      if (data?.ok) setMeta(data.credentials ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMeta(); }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payment/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, apiKey, mode,
          webhookToken: webhookToken || undefined,
          setActive: true,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setMsg({ kind: "ok", text: "Tersimpan & diaktifkan." });
        setApiKey(""); setWebhookToken("");
        await loadMeta();
      } else {
        setMsg({ kind: "err", text: data?.pesan ?? "Gagal menyimpan." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payment/credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, mode,
          apiKey: apiKey || undefined,
          webhookToken: webhookToken || undefined,
        }),
      });
      const data = await res.json();
      setMsg({ kind: data?.ok ? "ok" : "err", text: data?.message ?? "Tidak ada respons." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal menguji." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">Pembayaran QRIS</h1>
        <p className="text-sm text-muted-foreground">
          Hubungkan Payment Gateway milik Anda. Kunci API disimpan terenkripsi di server
          dan tidak pernah ditampilkan kembali.
        </p>
      </div>

      {/* Status terhubung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Memuat…"
              : savedActive
              ? `Terhubung • ${savedActive.provider.toUpperCase()} • ${savedActive.mode}`
              : "Belum ada gateway aktif."}
          </p>
        </CardHeader>
        {!loading && meta.length > 0 && (
          <CardContent className="flex flex-wrap gap-2">
            {meta.map((m) => (
              <span
                key={m.provider}
                className={`rounded-full border px-3 py-1 text-xs ${
                  m.is_active ? "border-green-500 text-green-600" : "text-muted-foreground"
                }`}
              >
                {m.provider} • {m.mode}{m.is_active ? " • aktif" : ""}
              </span>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Gateway</CardTitle>
          <p className="text-sm text-muted-foreground">Pilih provider, masukkan kunci, uji, simpan.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProvider(p.id); setMsg(null); }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    provider === p.id ? "border-primary bg-primary/5 font-medium" : ""
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key{savedForProvider ? " (isi untuk mengganti)" : ""}
            </Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              placeholder={current.keyHint}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Contoh: {current.keyHint}</p>
          </div>

          {current.tokenLabel && (
            <div className="space-y-2">
              <Label htmlFor="wt">{current.tokenLabel}</Label>
              <Input
                id="wt"
                type="password"
                autoComplete="off"
                placeholder={current.tokenLabel}
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
              />
              {current.tokenHint && (
                <p className="text-xs text-muted-foreground">{current.tokenHint}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              {(["sandbox", "production"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                    mode === m ? "border-primary bg-primary/5 font-medium" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
              {msg.text}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "Menguji…" : "Test Connection"}
            </Button>
            <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? "Menyimpan…" : "Simpan & Aktifkan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Daftarkan URL webhook ini di dashboard gateway Anda:
        <br />
        <code>https://&lt;domain-anda&gt;/api/payment/webhook/{provider}</code>
      </p>
    </div>
  );
}
