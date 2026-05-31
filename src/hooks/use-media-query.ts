"use client";

import * as React from "react";

/**
 * useMediaQuery — SSR-safe.
 *
 * Mengembalikan `null` saat render server / sebelum mount, lalu nilai boolean
 * setelah mount. Komponen yang sensitif terhadap layout (mis. memilih
 * Drawer vs Sheet) bisa menunda render sampai nilai ini bukan `null`,
 * sehingga TIDAK ada flash/remount seperti pada `useIsTablet` lama.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** ≥ 768px (breakpoint md Tailwind) → desktop/tablet-landscape. */
export function useIsDesktop(): boolean | null {
  return useMediaQuery("(min-width: 768px)");
}
