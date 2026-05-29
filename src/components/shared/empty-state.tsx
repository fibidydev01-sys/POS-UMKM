import * as React from "react";

export default function EmptyState({
  icon = "📦",
  judul,
  deskripsi,
  children,
}: {
  icon?: React.ReactNode;
  judul: string;
  deskripsi?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-bold text-foreground">{judul}</h3>
      {deskripsi && <p className="max-w-xs text-sm text-muted-foreground">{deskripsi}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
