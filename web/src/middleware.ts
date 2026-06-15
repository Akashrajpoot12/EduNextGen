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

  // 1. Always update session first to get auth cookies and user
  let response = NextResponse.next();
  const sessionData = await updateSession(req, response);
  response = sessionData.response;
  const user = sessionData.user;

  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const rootDomain = isLocalhost ? "localhost:3000" : "yoursaas.com";
  const adminDomain = isLocalhost ? "admin.localhost:3000" : "admin.yoursaas.com";

  // Extract tenant from path if using localhost folder structure (e.g., localhost:3000/blueate/admin)
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const isTenantPath = pathSegments.length > 0 && pathSegments[0] !== "api" && pathSegments[0] !== "_next";
  const isLoginPage = url.pathname.endsWith("/login");

  // Enforce auth on tenant paths
  if (!user && isTenantPath && !isLoginPage) {
    const tenant = pathSegments[0];
    return NextResponse.redirect(new URL(`/${tenant}/login`, req.url));
  }

  // Bypass rewrite for the root domain or the super admin domain
  if (hostname === rootDomain) {
    return response;
  }
  
  if (hostname === adminDomain) {
    if (!user && url.pathname !== "/login") {
      return NextResponse.redirect(new URL(`http://${rootDomain}/login`, req.url));
    }
    return response;
  }

  let currentHost = hostname.replace(`.${rootDomain}`, "");
  
  if (isLocalhost && currentHost.includes(":")) {
    currentHost = currentHost.split(":")[0].replace(".localhost", "");
  }

  if (currentHost === hostname || currentHost === "localhost") {
    return response;
  }

  // Create the rewrite response for the tenant (route groups like (platform) should not be included in the rewrite path)
  let rewriteResponse = NextResponse.rewrite(new URL(`/${currentHost}${url.pathname}`, req.url));
  
  // Copy all Supabase cookies from the initial session response to the rewrite response
  response.cookies.getAll().forEach(cookie => {
    rewriteResponse.cookies.set(cookie.name, cookie.value);
  });
  
  return rewriteResponse;
}
