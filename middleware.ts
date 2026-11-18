import { NextResponse, type NextRequest } from "next/server";
import { isHostedDemo } from "./lib/demo/hosting";

export function middleware(request: NextRequest) {
  if (!isHostedDemo()) return NextResponse.next();
  // No server actions or API mutations, even if a client bypasses the visible controls.
  if (!["GET", "HEAD"].includes(request.method)) {
    return new NextResponse("Hosted demo: server mutations are disabled.", { status: 405 });
  }
  const pathname = request.nextUrl.pathname;
  if (pathname === "/hosted-demo" || pathname === "/demo-behindthehood" || pathname === "/demo-behindthehood/" || pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/hosted-demo", request.url));
}
export const config = { matcher: "/:path*" };
