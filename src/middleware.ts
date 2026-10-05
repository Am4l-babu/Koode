import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: forwards the pathname (used for post-login redirects) and
 * performs a cheap cookie-presence gate on private areas. This is NOT the
 * security boundary — every page and API re-validates the session and role
 * server-side against the database.
 */
const PRIVATE_PREFIXES = ["/donor", "/recipient", "/admin", "/dashboard"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname + search);

  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const hasSession = req.cookies.has("sb_session") || req.cookies.has("__Host-sb_session");
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png).*)"],
};
