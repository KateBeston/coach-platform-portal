"use client";

import { useState } from "react";
import { notePasswordSet } from "@/app/login/actions";
import { Note } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { checkPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

/** New password, checked for length and known breaches, set on the current session. */
export function SetPasswordForm({ kind, onDone }: { kind: "Password changed" | "Joined"; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ ok: true, text: "Checking…" });
    const verdict = await checkPassword(pw);
    if (!verdict.ok) return setMsg({ ok: false, text: verdict.reason ?? "Choose a different password." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two entries don't match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await notePasswordSet(kind);
    setMsg({ ok: true, text: "Password set. Taking you to the portal…" });
    onDone();
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label className="label" htmlFor="p1">New password</label>
        <PasswordInput id="p1" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <p className="mt-1 text-xs text-muted">At least twelve characters. A long phrase beats a short one with symbols in it.</p>
      </div>
      <div>
        <label className="label" htmlFor="p2">Confirm password</label>
        <PasswordInput id="p2" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      </div>
      <button className="btn w-full" disabled={busy || !pw}>{busy ? "Saving…" : "Set password"}</button>
      {msg && <Note bad={!msg.ok}>{msg.text}</Note>}
    </form>
  );
}
