"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [0, 5, 10, 15, 20];

export default function DiskonInput({
  value,
  onChange,
  label = "Diskon",
}: {
  value: number;
  onChange: (persen: number) => void;
  label?: string;
}) {
  function setCustom(raw: string) {
    let n = parseInt(raw.replace(/[^0-9]/g, "") || "0", 10);
    if (n > 100) n = 100;
    onChange(n);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <span className="text-sm font-bold text-primary">{value}%</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
              value === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"
            )}
          >
            {p}%
          </button>
        ))}
        <div className="relative w-20">
          <Input
            inputMode="numeric"
            value={value === 0 ? "" : String(value)}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="0"
            className="h-9 pr-6 text-center"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
      </div>
    </div>
  );
}
