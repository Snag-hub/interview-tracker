import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware-client";

const protectedPagePrefixes = ["/dashboard", "/calendar", "/settings", "/applications"];
const protectedApiPrefixes = [
  "/api/applications",
  "/api/rounds",
  "/api/subscription",
  "/api/gmail",
  "/api/sync",
];
const authPassthroughPaths = ["/auth/callback", "/auth/sign-out"];

function isProtectedPage(pathname: string) {
  return protectedPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedApi(pathname: string) {
  return protectedApiPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPassthroughPath(pathname: string) {
  return authPassthroughPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await refreshSupabaseSession(request);

  if (pathname.startsWith("/auth") && user && !isAuthPassthroughPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedApi(pathname) && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtectedPage(pathname) && !user) {
    const loginUrl = new URL("/auth/sign-in", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/calendar/:path*", "/settings/:path*", "/applications/:path*", "/api/:path*", "/auth/:path*"],
};
