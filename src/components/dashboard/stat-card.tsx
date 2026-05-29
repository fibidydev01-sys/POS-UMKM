import * as React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  nilai,
  sub,
  icon,
  highlight = false,
}: {
  label: string;
  nilai: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlight ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-semibold", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {label}
        </span>
        {icon && <span className={highlight ? "text-primary-foreground/80" : "text-muted-foreground"}>{icon}</span>}
      </div>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight">{nilai}</p>
      {sub && (
        <p className={cn("text-xs", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</p>
      )}
    </div>
  );
}
