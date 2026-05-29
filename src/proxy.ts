// Next.js 16: file ini menggantikan middleware.ts (fungsi diberi nama `proxy`).
// Tugas: cek cookie umkm_id. Belum aktif → redirect ke /aktivasi.
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/aktivasi", "/api/aktivasi"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const umkmId = request.cookies.get("umkm_id")?.value;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!umkmId) {
    return NextResponse.redirect(new URL("/aktivasi", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
