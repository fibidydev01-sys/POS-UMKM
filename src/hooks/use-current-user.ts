"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/db/users";
import { getUmkmId, getOwnerId } from "@/lib/utils/umkm-id";

interface UseCurrentUserResult {
  user: CurrentUser | null;
  umkmId: string | null;
  ownerId: string | null;
  isLoading: boolean;
}

/**
 * Satu-satunya sumber identitas untuk semua halaman.
 *
 * Menggabungkan dua jalur lama:
 *  - getCurrentUser() — query DB (dipakai dashboard/kasir/riwayat)
 *  - getUmkmId()/getOwnerId() — baca cookie sync (dipakai menu/pengaturan)
 *
 * Jika `requireUser` true (default), validasi penuh ke DB dan redirect ke
 * /aktivasi bila tidak ada. Jika false, cukup pakai cookie (lebih cepat,
 * tanpa round-trip) — cocok untuk halaman owner-only seperti pengaturan.
 */
export function useCurrentUser(requireUser = true): UseCurrentUserResult {
  const router = useRouter();
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [ids, setIds] = React.useState<{ umkmId: string | null; ownerId: string | null }>({
    umkmId: null,
    ownerId: null,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const cookieUmkm = getUmkmId();
      const cookieOwner = getOwnerId();

      if (!requireUser) {
        if (!cookieUmkm) {
          router.replace("/aktivasi");
          return;
        }
        if (!alive) return;
        setIds({ umkmId: cookieUmkm, ownerId: cookieOwner });
        setIsLoading(false);
        return;
      }

      const u = await getCurrentUser();
      if (!alive) return;
      if (!u) {
        router.replace("/aktivasi");
        return;
      }
      setUser(u);
      setIds({ umkmId: u.umkm_id, ownerId: u.id });
      setIsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router, requireUser]);

  return { user, umkmId: ids.umkmId, ownerId: ids.ownerId, isLoading };
}
