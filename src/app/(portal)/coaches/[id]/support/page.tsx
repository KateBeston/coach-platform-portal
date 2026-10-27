import { OpenAccount } from "@/components/open-account";
import { Banner, Empty, Pill } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ, requireArea } from "@/lib/staff";
import { endSupportFromPortalAction } from "../../../actions";

type Row = { id: string; staff_name: string | null; reason: string; started_at: string; expires_at: string; ended_at: string | null; active: boolean };

export default async function SupportTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  await requireArea("coach_access");
  const { supabase, name } = await getCoachRecord(id);
  const { data } = await supabase.rpc("admin_support_sessions", { p_coach: id });
  const rows = (data ?? []) as Row[];
  const mine = rows.find((r) => r.active);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="card h-fit">
        <Banner error={error} />
        <h2 className="section-title">Open {name}&apos;s account</h2>
        {mine ? (
          <div className="space-y-3 text-sm">
            <p>A support session is open until {fmtDateTime(mine.expires_at, PORTAL_TZ)}.</p>
            <a href={appUrl} target="_blank" className="btn w-full">Go to their account</a>
            <form action={endSupportFromPortalAction}>
              <input type="hidden" name="coach_id" value={id} />
              <button className="btn-ghost w-full">End support session</button>
            </form>
          </div>
        ) : (
          <OpenAccount coachId={id} />
        )}
        <p className="mt-4 text-xs text-muted">
          You&apos;ll need to be signed in to the coach app with your own email. While a session is open, the coach app shows their business instead of yours, with a banner across the top.
        </p>
      </section>

      <section className="card lg:col-span-2">
        <h2 className="section-title">Support history</h2>
        {rows.length ? (
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{r.reason}</p>
                  <p className="text-xs text-muted">
                    {r.staff_name ?? "Staff"} · {fmtDateTime(r.started_at, PORTAL_TZ)}
                    {r.ended_at ? ` to ${fmtDateTime(r.ended_at, PORTAL_TZ)}` : !r.active ? " · expired" : ""}
                  </p>
                </div>
                {r.active && <Pill status="active" label="open now" />}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nobody has opened this account yet.</Empty>
        )}
      </section>
    </div>
  );
}
