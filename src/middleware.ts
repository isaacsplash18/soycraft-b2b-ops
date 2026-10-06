import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, ADMIN_ONLY_PREFIXES, roleFromCookie } from "@/lib/roles";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes. /api/cron is protected by its own CRON_SECRET
  // bearer check inside the route handler (Vercel cron can't send cookies).
  const isPublicRoute =
    pathname === "/access" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get(AUTH_COOKIE)?.value;
  const role = roleFromCookie(authCookie);

  // API auth
  if (pathname.startsWith("/api/")) {
    if (!role) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (
      ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) &&
      role !== "admin"
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    return NextResponse.next();
  }

  // Page auth
  if (!role) {
    const accessUrl = new URL("/access", req.url);
    accessUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(accessUrl);
  }

  // Admin-only pages: send staff back to dashboard
  if (
    ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) &&
    role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|soycraft-wordmark.png|soycraft-logo.png).*)",
  ],
};
