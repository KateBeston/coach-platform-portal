import Link from "next/link";
import { EmailList } from "@/components/email-list";
import { Empty } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { EMAIL_KIND, usd } from "@/lib/email-kinds";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

export default async function CoachEmailsTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ open?: string }> }) {
  const { id } = await params;
  const { open } = await searchParams;
  const { supabase } = await getCoachRecord(id);
  const [{ data: rows }, { data: templates }, { data: ai }, { data: settings }] = await Promise.all([
    supabase.from("email_outbox").select("id, kind, to_email, to_name, subject, body_text, status, status_note, created_at, sent_at, coach_id").eq("coach_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("email_templates").select("kind, mode, preset_key, updated_at").eq("coach_id", id),
    supabase.from("ai_usage").select("*").eq("coach_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("coaches").select("email_confirmations, email_reminders, reminder_hours, email_nudges").eq("id", id).maybeSingle(),
  ]);
  const MODE: Record<string, string> = { preset: "Template", ai: "AI draft", custom: "Own words" };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card">
          <h2 className="section-title">Their email settings</h2>
          <ul className="space-y-1 text-sm">
            <li>Booking emails: {settings?.email_confirmations ? "on" : "off"}</li>
            <li>Reminders: {settings?.email_reminders ? `on, ${settings.reminder_hours} hours before` : "off"}</li>
            <li>Morning &quot;not booked&quot; email: {settings?.email_nudges ? "on" : "off"}</li>
          </ul>
        </section>
        <section className="card">
          <h2 className="section-title">Their wording</h2>
          {templates?.length ? (
            <ul className="space-y-1 text-sm">
              {templates.map((t) => (
                <li key={t.kind}>{EMAIL_KIND[t.kind]}: {MODE[t.mode]}{t.preset_key ? ` (${t.preset_key})` : ""} · {fmtDateTime(t.updated_at, PORTAL_TZ)}</li>
              ))}
            </ul>
          ) : (
            <Empty>Using the standard wording for everything.</Empty>
          )}
        </section>
        <section className="card">
          <h2 className="section-title">AI use</h2>
          {ai?.length ? (
            <>
              <p className="text-sm">{ai.length} requests · {usd(ai.reduce((t, r) => t + Number(r.cost_usd), 0))}</p>
              <Link href={`/platform/ai?coach=${id}`} className="text-sm text-accent hover:underline">See each one</Link>
            </>
          ) : (
            <Empty>No AI use yet.</Empty>
          )}
        </section>
      </div>
      <EmailList rows={rows ?? []} open={open} hrefFor={(e) => `/coaches/${id}/emails?open=${e}`} />
    </div>
  );
}
