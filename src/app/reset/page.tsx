"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell, Note } from "@/components/auth-shell";
import { SetPasswordForm } from "@/components/set-password-form";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  return (
    <AuthShell title="Set a new password">
      <Suspense fallback={<Note>Checking the link…</Note>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"checking" | "ready" | "bad">("checking");

  useEffect(() => {
    const supabase = createClient();
    const code = params.get("code");
    let live = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return live && setState("ready");
      // The emailed link carries a one-time code that must be exchanged for a session.
      if (code && !(await supabase.auth.exchangeCodeForSession(code)).error) {
        window.history.replaceState({}, "", "/reset");
        return live && setState("ready");
      }
      if (live) setState("bad");
    })();
    return () => {
      live = false;
    };
  }, [params]);

  if (state === "checking") return <Note>Checking the link…</Note>;
  if (state === "bad")
    return <Note bad>This link is invalid or has expired. Reset links are single use and time limited. Ask for a new one from the sign-in page.</Note>;
  return <SetPasswordForm kind="Password changed" onDone={() => setTimeout(() => router.push("/"), 1000)} />;
}
