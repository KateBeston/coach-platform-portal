import Link from "next/link";
import { notFound } from "next/navigation";
import { Banner, Empty, Pill } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtRelativeDays } from "@/lib/format";
import { getStaff, PORTAL_TZ, type CoachRow } from "@/lib/staff";
import { addNoteAction, updateAccountAction } from "../../actions";

const NOTE_KINDS = ["note", "support", "feedback", "call", "billing"];

export default async function CoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { supabase } = await getStaff();
  const [{ data: coaches }, { data: notes }, { data: account }] = await Promise.all([
    supabase.rpc("admin_coaches"),
    supabase.from("admin_notes").select("*").eq("coach_id", id).order("created_at", { ascending: false }),
    supabase.from("coach_accounts").select("*").eq("coach_id", id).maybeSingle(),
  ]);
  const c = ((coaches ?? []) as CoachRow[]).find((x) => x.id === id);
  if (!c) notFound();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const name = c.business_name || c.display_name || c.email || "Coach";

  return (
    <>
      <Banner error={error} message={saved ? "Saved." : undefined} />
      <p className="text-sm text-muted"><Link href="/coaches" className="hover:text-ink">Coaches</Link> /</p>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {c.is_internal ? <Pill status="internal" label="staff test" /> : <Pill status={c.status ?? "trial"} />}
            {c.email && <a href={`mailto:${c.email}`} className="hover:text-ink">{c.email}</a>}
            {c.business_name && c.display_name && <span>· {c.display_name}</span>}
            <span>· joined {fmtDate(c.created_at, PORTAL_TZ)}</span>
          </p>
        </div>
        {c.booking_slug && (
          <a href={`${appUrl}/book/${c.booking_slug}`} target="_blank" className="btn-ghost">Their booking page</a>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card">
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
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">Counts only. The portal can&apos;t see a coach&apos;s clients, notes or session details.</p>
          </section>

          <section className="card">
            <h2 className="section-title">Notes</h2>
            <form action={addNoteAction} className="mb-5 space-y-2">
              <input type="hidden" name="coach_id" value={id} />
              <div className="flex gap-2">
                <select name="kind" className="input w-36">
                  {NOTE_KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
                </select>
                <button className="btn">Add note</button>
              </div>
              <textarea name="body" className="input min-h-20" placeholder="Support request, feedback, a call, a billing change…" required />
            </form>
            {notes?.length ? (
              <ul className="space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-line pl-3">
                    <p className="text-xs text-muted capitalize">{n.kind} · {fmtDateTime(n.created_at, PORTAL_TZ)}</p>
                    <p className="mt-1 text-sm whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No notes yet.</Empty>
            )}
          </section>
        </div>

        <section className="card h-fit">
          <h2 className="section-title">Account</h2>
          <form action={updateAccountAction} className="space-y-3">
            <input type="hidden" name="coach_id" value={id} />
            <div>
              <label className="label">Plan</label>
              <select name="plan" className="input" defaultValue={account?.plan ?? "trial"}>
                <option value="trial">Trial</option>
                <option value="founding">Founding member</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="comp">Complimentary</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={account?.status ?? "trial"}>
                <option value="trial">Trial</option>
                <option value="active">Active (paying)</option>
                <option value="past_due">Payment overdue</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Trial ends</label>
              <input type="date" name="trial_ends_at" className="input" defaultValue={account?.trial_ends_at ?? ""} />
            </div>
            <div>
              <label className="label">Monthly price ($)</label>
              <input type="number" name="monthly_price" className="input" min={0} step="0.01" defaultValue={account ? (account.monthly_price_cents / 100).toFixed(2) : ""} />
            </div>
            <div>
              <label className="label">How they found us</label>
              <input name="source" className="input" defaultValue={account?.source ?? ""} placeholder="Coaching school, referral, Instagram…" />
            </div>
            <button className="btn w-full">Save account</button>
            {account?.updated_at && <p className="text-xs text-muted">Updated {fmtDateTime(account.updated_at, PORTAL_TZ)}</p>}
          </form>
        </section>
      </div>
    </>
  );
}
