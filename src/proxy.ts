// Next.js middleware (proxy.ts menggantikan middleware.ts)
// Owner-only: cek cookie umkm_id saja.
// Tidak ada Supabase Auth, tidak ada role guard, tidak ada session check.
// Kalau tidak ada cookie umkm_id → redirect ke /aktivasi.

import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/aktivasi", "/api/aktivasi"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Aset statis — lewati
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Path publik — tidak perlu cek cookie
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cek cookie umkm_id
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) {
    return NextResponse.redirect(new URL("/aktivasi", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
