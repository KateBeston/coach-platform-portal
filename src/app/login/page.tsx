"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { AuthShell, Note } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <AuthShell title="Sign in">
      <Suspense>
        <WhyHere />
      </Suspense>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        {state?.error && <Note bad>{state.error}</Note>}
      </form>
      <p className="mt-4 flex justify-between text-sm">
        <Link href="/forgot" className="text-accent hover:underline">Forgotten your password?</Link>
        <Link href="/join" className="text-muted hover:text-ink">Got an invitation?</Link>
      </p>
    </AuthShell>
  );
}

/** Why somebody is back at sign-in. Without it a time-out looks like a fault. */
function WhyHere() {
  const params = useSearchParams();
  const ended = params.get("ended");
  const error = params.get("error");
  const text = error
    ? error
    : ended === "idle"
      ? "Signed out after two hours with nothing happening. Everything you saved is still there."
      : ended === "limit"
        ? "Signed out after twelve hours. Sessions don't run longer than that."
        : params.get("reset")
          ? "Password set. Sign in with it now."
          : null;
  if (!text) return null;
  return (
    <div className="mb-4">
      <Note bad={!!error}>{text}</Note>
    </div>
  );
}
