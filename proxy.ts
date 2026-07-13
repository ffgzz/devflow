import { auth } from "@/auth";
import { NextResponse } from "next/server";

const authOnlyRoutes = new Set(["/sign-in", "/sign-up"]);

const protectedRoutePatterns = [
  /^\/ask-question(?:\/|$)/,
  /^\/collection(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/profile\/edit(?:\/|$)/,
  /^\/questions\/[^/]+\/edit(?:\/|$)/,
];

const isProtectedRoute = (pathname: string) =>
  protectedRoutePatterns.some((pattern) => pattern.test(pathname));

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user?.id);

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && authOnlyRoutes.has(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
    },
  ],
};
