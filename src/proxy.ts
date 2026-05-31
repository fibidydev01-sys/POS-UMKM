import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/aktivasi", "/api/aktivasi"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const umkmId = request.cookies.get("umkm_id")?.value;
  if (!umkmId) return NextResponse.redirect(new URL("/aktivasi", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
