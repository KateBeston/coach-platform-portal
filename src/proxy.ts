import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything served from /public is excluded, fonts included: a font request
  // redirected to /login comes back as HTML and the browser can't decode it.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|js|css|map|txt|xml|pdf)$).*)",
  ],
};
