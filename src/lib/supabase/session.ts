import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Pages reachable without a session. Everything else needs one. */
const PUBLIC = ["/login", "/forgot", "/reset", "/join", "/auth", "/api/legal/"];

/** Refreshes the session on every request and sends anyone signed out to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Supabase falls back to the Site URL when a redirect isn't on its allow list, so a
  // recovery code can land anywhere. Carry it to /reset rather than drop it at /login.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !["/reset", "/join", "/auth"].some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/reset";
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
