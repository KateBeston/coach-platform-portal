"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, Note } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // This origin, so a reset asked for on a preview returns to that preview.
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(false);
    // The same message either way: confirming an address has an account helps an attacker.
    setMsg(error && /rate/i.test(error.message) ? error.message : "If that address has an account, a reset link is on its way.");
  }

  return (
    <AuthShell title="Reset password">
      <form onSubmit={send} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button className="btn w-full" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send reset link"}</button>
        {msg && <Note>{msg}</Note>}
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
