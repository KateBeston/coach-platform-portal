import Link from "next/link";
import { Empty, PageHeader, Pill, Stat } from "@/components/ui";
import { fmtDate, fmtRelativeDays, money } from "@/lib/format";
import { getStaff, PORTAL_TZ, type CoachRow } from "@/lib/staff";

type Overview = {
  coaches_total: number;
  signups_7d: number;
  signups_30d: number;
  active_7d: number;
  on_trial: number;
  trials_ending_7d: number;
  paying: number;
  mrr_cents: number;
  cancelled: number;
  sessions_30d: number;
  clients_total: number;
  signups_by_week: { week: string; count: number }[];
};

/** ISO timestamp for "n days ago". */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export default async function OverviewPage() {
  const { supabase } = await getStaff();
  const [{ data: ov }, { data: coaches }] = await Promise.all([supabase.rpc("admin_overview"), supabase.rpc("admin_coaches")]);
  const o = (ov ?? {}) as Overview;
  const rows = ((coaches ?? []) as CoachRow[]).filter((c) => !c.is_internal);
  const today = daysAgo(0).slice(0, 10);
  const fortnightAgo = daysAgo(14);

  const trialsEnding = rows
    .filter((c) => c.status === "trial" && c.trial_ends_at && c.trial_ends_at >= today)
    .sort((a, b) => (a.trial_ends_at! < b.trial_ends_at! ? -1 : 1))
    .slice(0, 6);
  const quiet = rows
    .filter((c) => c.status !== "cancelled" && (!c.last_sign_in_at || c.last_sign_in_at < fortnightAgo))
    .slice(0, 6);
  const weeks = o.signups_by_week ?? [];
  const peak = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <>
      <PageHeader title="Overview" sub="How the software business is going. Test accounts on the staff list are left out." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Coaches" value={String(o.coaches_total ?? 0)} hint={`${o.signups_30d ?? 0} joined in the last 30 days`} href="/coaches" />
        <Stat label="Monthly recurring revenue" value={money(o.mrr_cents ?? 0)} hint={`${o.paying ?? 0} paying`} />
        <Stat label="On trial" value={String(o.on_trial ?? 0)} hint={`${o.trials_ending_7d ?? 0} ending this week`} href="/coaches?status=trial" />
        <Stat label="Active this week" value={String(o.active_7d ?? 0)} hint="Signed in within 7 days" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="section-title">Sign-ups per week</h2>
          {weeks.length ? (
            <div className="flex h-40 items-end gap-1.5">
              {weeks.map((w) => (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] text-muted">{w.count || ""}</span>
                  <div className="w-full rounded-t bg-accent" style={{ height: `${(w.count / peak) * 120}px`, minHeight: w.count ? 4 : 1, opacity: w.count ? 1 : 0.2 }} />
                  <span className="text-[10px] text-muted">
                    {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(w.week + "T00:00:00Z"))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No sign-ups yet.</Empty>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">Usage</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Clients managed</dt><dd>{o.clients_total ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Sessions completed, 30 days</dt><dd>{o.sessions_30d ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Joined this week</dt><dd>{o.signups_7d ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Cancelled</dt><dd>{o.cancelled ?? 0}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="section-title">Trials ending soonest</h2>
          {trialsEnding.length ? (
            <ul className="space-y-2 text-sm">
              {trialsEnding.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link href={`/coaches/${c.id}`} className="truncate hover:text-accent">{c.business_name || c.display_name || c.email}</Link>
                  <span className="shrink-0 text-muted">{fmtDate(c.trial_ends_at!)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No trials running.</Empty>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">Gone quiet</h2>
          {quiet.length ? (
            <ul className="space-y-2 text-sm">
              {quiet.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link href={`/coaches/${c.id}`} className="truncate hover:text-accent">{c.business_name || c.display_name || c.email}</Link>
                  <span className="shrink-0 text-muted">{fmtRelativeDays(c.last_sign_in_at)}</span>
                </li>
              ))}
              <p className="pt-1 text-xs text-muted">Not signed in for two weeks. Worth a check-in.</p>
            </ul>
          ) : (
            <Empty>Everyone has signed in in the last fortnight.</Empty>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">Newest coaches</h2>
          {rows.length ? (
            <ul className="space-y-2 text-sm">
              {rows.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/coaches/${c.id}`} className="truncate hover:text-accent">{c.business_name || c.display_name || c.email}</Link>
                  <span className="flex shrink-0 items-center gap-2 text-muted">{fmtDate(c.created_at, PORTAL_TZ)} <Pill status={c.status ?? "trial"} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No coaches have signed up yet.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
