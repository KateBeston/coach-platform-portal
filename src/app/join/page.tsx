"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Note } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { checkPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

/** Accepting a staff invitation: the invited address creates its login here. */
export default function JoinPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setBusy(true);
    setMsg(null);
    const { data: open } = await supabase.rpc("staff_invite_open", { p_email: email });
    if (!open) {
      setBusy(false);
      return setMsg({
        ok: false,
        text: "There's no open invitation for that address. If you already have a login (for example, you also coach), just sign in.",
      });
    }
    const verdict = await checkPassword(pw);
    if (!verdict.ok) {
      setBusy(false);
      return setMsg({ ok: false, text: verdict.reason ?? "Choose a different password." });
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pw,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setMsg({ ok: true, text: "Check your email to confirm the address, then you're in." });
  }

  return (
    <AuthShell title="Accept your invitation">
      <form onSubmit={join} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Invited email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="pw">Choose a password</label>
          <PasswordInput id="pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <p className="mt-1 text-xs text-muted">At least twelve characters.</p>
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Setting up…" : "Create my login"}</button>
        {msg && <Note bad={!msg.ok}>{msg.text}</Note>}
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
