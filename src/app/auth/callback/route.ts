import { NextResponse, type NextRequest } from "next/server";
import { recordAccess } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

/** Where the email-confirmation link for a new staff login lands. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user?.email) await recordAccess(data.user.email, "Joined");
      return NextResponse.redirect(`${origin}/`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That link has expired. Try signing in, or ask for a new invitation.")}`);
}
