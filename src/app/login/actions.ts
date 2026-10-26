"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Event = "Signed in" | "Signed out" | "Failed" | "Timed out" | "Session ended" | "Password changed" | "Joined";

/** Writes one line to the portal's access log. Never allowed to break a sign-in. */
export async function recordAccess(email: string, event: Event, reason?: string) {
  try {
    const supabase = await createClient();
    const h = await headers();
    await supabase.rpc("portal_record_access", {
      p_email: email,
      p_event: event,
      p_reason: reason ?? undefined,
      p_ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || undefined,
      p_ua: h.get("user-agent") ?? undefined,
    });
  } catch {
    // Logged or not, the person carries on.
  }
}

export async function signIn(_prev: { error?: string } | null, fd: FormData) {
  const supabase = await createClient();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();

  // Repeated failures slow down, then stop for fifteen minutes. Temporary, so
  // knowing someone's address isn't enough to lock them out.
  const { data: gate } = await supabase.rpc("portal_login_blocked", { p_email: email });
  const g = gate as { blocked?: boolean; slow?: boolean; try_again_in?: number } | null;
  if (g?.blocked) {
    await recordAccess(email, "Failed", "Blocked: too many attempts");
    return { error: `Too many attempts. Try again in ${g.try_again_in} minute${g.try_again_in === 1 ? "" : "s"}, or reset your password.` };
  }
  if (g?.slow) await new Promise((r) => setTimeout(r, 2000));

  const { error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
  if (error) {
    await recordAccess(email, "Failed", error.message);
    // Vague on purpose: "no account with that email" tells someone which addresses to try.
    return { error: "That email and password don't match an account." };
  }

  // A right password isn't the same as still being allowed in.
  let { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    const { data: claimed } = await supabase.rpc("claim_staff_invite");
    isStaff = !!claimed;
  }
  if (!isStaff) {
    await recordAccess(email, "Failed", "Not staff or inactive");
    await supabase.auth.signOut();
    return { error: "That account doesn't have access to the internal portal. Speak to whoever runs it." };
  }

  await recordAccess(email, "Signed in");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) await recordAccess(user.email, "Signed out");
  await supabase.auth.signOut();
  redirect("/login");
}

/** A session that ran out rather than being closed. Logged as its own event. */
export async function timedOut(reason: "Timed out" | "Session ended") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) await recordAccess(user.email, reason);
  await supabase.auth.signOut();
  redirect(`/login?ended=${reason === "Timed out" ? "idle" : "limit"}`);
}

/** Called from the browser after a password is set on /reset or /join. */
export async function notePasswordSet(kind: "Password changed" | "Joined") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) await recordAccess(user.email, kind);
}
