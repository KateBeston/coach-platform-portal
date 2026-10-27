import Link from "next/link";
import { OpenAccount } from "@/components/open-account";
import { Empty } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDate, fmtDateTime, fmtRelativeDays, money } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

export default async function CoachOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { c, supabase, can } = await getCoachRecord(id);
  const { data: usageRaw } = await supabase.rpc("admin_coach_usage", { p_coach: id });
  const u = (usageRaw ?? {}) as Record<string, number>;
  const { data: notes } = can("notes")
    ? await supabase.from("admin_notes").select("id, kind, body, created_at").eq("coach_id", id).order("created_at", { ascending: false }).limit(3)
    : { data: null };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="card lg:col-span-2">
        <h2 className="section-title">Usage</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {[
            ["Active clients", `${c.clients_active} of ${c.clients_total}`],
            ["Arrangements", c.arrangements_active],
            ["Sessions, 30 days", c.sessions_30d],
            ["Upcoming sessions", c.sessions_upcoming],
            ["Invoices", c.invoices_total],
            ["Offers", c.offers_total],
            ["Last sign-in", fmtRelativeDays(c.last_sign_in_at)],
            ["Last activity", c.last_activity_at ? fmtDateTime(c.last_activity_at, PORTAL_TZ) : "None"],
            ["Team", u.team_practitioners ? `${u.team_active} people` : "Solo"],
            ["Expenses logged", `${u.expenses ?? 0}${u.expenses_30d ? ` (${u.expenses_30d} this month)` : ""}`],
            ["Receipts uploaded", u.receipts ?? 0],
            ["Invoices paid", u.invoices_paid ?? 0],
            ["Session notes", u.notes ?? 0],
            ["Goals", u.goals ?? 0],
            ["Booked by clients", u.booked_by_clients ?? 0],
            ["Calendar entries", u.calendar_events ?? 0],
            ["Emails sent", u.emails_sent ?? 0],
            ["Communications logged", u.comms_logged ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">To see or change their actual clients, sessions, invoices or money, open their account.</p>
      </section>

      <div className="space-y-5">
        {can("coach_access") && (
          <section className="card">
            <h2 className="section-title">Open their account</h2>
            <OpenAccount coachId={id} />
          </section>
        )}
        <section className="card">
          <h2 className="section-title">Account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Plan</dt><dd className="capitalize">{c.plan ?? "trial"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="capitalize">{(c.status ?? "trial").replace("_", " ")}</dd></div>
            {c.status === "trial" && c.trial_ends_at && (
              <div className="flex justify-between"><dt className="text-muted">Trial ends</dt><dd>{fmtDate(c.trial_ends_at)}</dd></div>
            )}
            {can("accounts") && (
              <div className="flex justify-between"><dt className="text-muted">Monthly</dt><dd>{money(c.monthly_price_cents ?? 0)}</dd></div>
            )}
          </dl>
          {can("accounts") && <Link href={`/coaches/${id}/account`} className="mt-3 inline-block text-sm text-accent hover:underline">Change plan or billing</Link>}
        </section>

        {can("notes") && (
          <section className="card">
            <h2 className="section-title">Latest notes</h2>
            {notes?.length ? (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-line pl-3">
                    <p className="text-xs text-muted capitalize">{n.kind} · {fmtDateTime(n.created_at, PORTAL_TZ)}</p>
                    <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No notes yet.</Empty>
            )}
            <Link href={`/coaches/${id}/notes`} className="mt-3 inline-block text-sm text-accent hover:underline">All notes</Link>
          </section>
        )}
      </div>
    </div>
  );
}
