import { Skeleton } from "@/components/ui/skeleton";

type Variant = "kasir" | "dashboard" | "list" | "form";

export function PageSkeleton({ variant }: { variant: Variant }) {
  if (variant === "kasir") {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-5">
        <Skeleton className="mb-1 h-4 w-16" />
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="mb-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <Skeleton className="mb-1 h-4 w-28" />
        <Skeleton className="mb-4 h-6 w-44" />
        <Skeleton className="mb-3 h-24 w-full rounded-xl" />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="mb-4 h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5">
      <Skeleton className="mb-1 h-4 w-20" />
      <Skeleton className="mb-4 h-6 w-44" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
