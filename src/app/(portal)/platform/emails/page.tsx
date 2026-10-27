import Link from "next/link";
import { EmailList } from "@/components/email-list";
import { PageHeader, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ, requireArea, type CoachRow } from "@/lib/staff";

const FILTERS = [["all", "Everything"], ["queued", "Waiting"], ["sent", "Sent"], ["failed", "Didn't send"], ["skipped", "Not needed"]] as const;

export default async function PlatformEmailsPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string; coach?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const { supabase } = await requireArea("coaches");
  let q = supabase.from("email_outbox").select("id, kind, to_email, to_name, subject, body_text, status, status_note, created_at, sent_at, coach_id").order("created_at", { ascending: false }).limit(300);
  if (status !== "all") q = q.eq("status", status);
  if (sp.coach) q = q.eq("coach_id", sp.coach);
  const [{ data: rows }, { data: healthRaw }, { data: coaches }] = await Promise.all([q, supabase.rpc("admin_messaging_health"), supabase.rpc("admin_coaches")]);
  const h = (healthRaw ?? {}) as Record<string, string | number | boolean | null>;
  const names = new Map(((coaches ?? []) as CoachRow[]).map((c) => [c.id, c.business_name || c.display_name || c.email || "Coach"]));
  const qs = (extra: Record<string, string>) => new URLSearchParams({ status, ...(sp.coach ? { coach: sp.coach } : {}), ...extra }).toString();

  return (
    <>
      <PageHeader title="Emails" sub="Every automatic email the coach app sends, for every coach." />
      {!h.email_key_set && (
        <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Email sending isn&apos;t connected yet, so emails are written and held. {Number(h.waiting_setup ?? 0)} waiting. They go out once the Resend key is added in Supabase.
        </p>
      )}
      {Number(h.failed_runs_24h ?? 0) > 0 && (
        <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">The background job failed {h.failed_runs_24h} times in the last day. Reminders may be late.</p>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sent, 7 days" value={String(h.sent_7d ?? 0)} />
        <Stat label="Waiting" value={String(h.waiting ?? 0)} hint={h.email_key_set ? "Goes out within 10 minutes" : "Held until email is connected"} />
        <Stat label="Didn't send, 7 days" value={String(h.failed_7d ?? 0)} href="/platform/emails?status=failed" />
        <Stat label="Background job" value={h.last_status === "succeeded" ? "Running" : h.last_run ? String(h.last_status) : "Not run yet"} hint={h.last_run ? `Last ran ${fmtDateTime(String(h.last_run), PORTAL_TZ)}` : "Runs every 10 minutes"} />
      </div>
      <p className="mb-4 text-xs text-muted">Sending from: {String(h.from_address ?? "")}</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/platform/emails?${new URLSearchParams({ status: k, ...(sp.coach ? { coach: sp.coach } : {}) })}`} className={`rounded-full px-3 py-1 text-sm ${status === k ? "bg-accent text-white" : "bg-surface text-ink/80 ring-1 ring-line"}`}>{label}</Link>
        ))}
        {sp.coach && <Link href={`/platform/emails?status=${status}`} className="text-sm text-accent hover:underline">Showing {names.get(sp.coach)} · show all coaches</Link>}
      </div>
      <EmailList rows={rows ?? []} open={sp.open} hrefFor={(id) => `/platform/emails?${qs({ open: id })}`} coachNames={sp.coach ? undefined : names} />
    </>
  );
}
