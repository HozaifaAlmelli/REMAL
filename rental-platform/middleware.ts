import { NextResponse } from "next/server";

// Route protection is enforced CLIENT-SIDE by the portal shells
// (AdminShell / OwnerLayout / useClientGuard), which hold the in-memory access
// token and refresh against the API host.
//
// This middleware intentionally does NOT gate on the `refresh_token` cookie.
// The API sets that cookie host-only on api.kaza-booking.com (no Domain
// attribute), so the browser never sends it to app.kaza-booking.com. Gating on
// it here made the Edge middleware always "see no cookie" in production and
// redirect protected routes to /auth/*/login; the login pages then bounced back
// to the dashboard (in-memory access token present) -> an infinite post-login
// redirect loop that froze the tab.
//
// Keep this a pass-through unless the refresh cookie is made readable at the app
// origin (e.g. Domain=.kaza-booking.com). See: post-login freeze fix.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - api (API routes)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|api|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
};
