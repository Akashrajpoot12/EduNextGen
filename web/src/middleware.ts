import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const rootDomain = isLocalhost ? "localhost:3000" : "yoursaas.com";
  const adminDomain = isLocalhost ? "admin.localhost:3000" : "admin.yoursaas.com";

  // Bypass rewrite for the root domain or the super admin domain
  if (hostname === rootDomain || hostname === adminDomain) {
    let response = NextResponse.next();
    return await updateSession(req, response);
  }

  let currentHost = hostname.replace(`.${rootDomain}`, "");
  
  if (isLocalhost && currentHost.includes(":")) {
    currentHost = currentHost.split(":")[0].replace(".localhost", "");
  }

  if (currentHost === hostname || currentHost === "localhost") {
    let response = NextResponse.next();
    return await updateSession(req, response);
  }

  // Create the rewrite response for the tenant
  let response = NextResponse.rewrite(new URL(`/(platform)/${currentHost}${url.pathname}`, req.url));
  
  // Pass the rewrite response through the Supabase session updater
  return await updateSession(req, response);
}
