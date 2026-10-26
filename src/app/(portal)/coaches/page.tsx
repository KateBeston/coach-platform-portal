import Link from "next/link";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { fmtDate, fmtRelativeDays, money } from "@/lib/format";
import { requireArea, PORTAL_TZ, type CoachRow } from "@/lib/staff";

const FILTERS = ["all", "trial", "active", "past_due", "paused", "cancelled"];

export default async function CoachesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q = "" } = await searchParams;
  const { supabase, can } = await requireArea("coaches");
  const { data } = await supabase.rpc("admin_coaches");
  const needle = q.toLowerCase();
  const rows = ((data ?? []) as CoachRow[])
    .filter((c) => status === "all" || c.status === status)
    .filter((c) => !needle || [c.email, c.display_name, c.business_name].some((v) => v?.toLowerCase().includes(needle)));

  return (
    <>
      <PageHeader title="Coaches" sub="Everyone with an account. Usage is shown as counts only; coaches' client details stay private." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/coaches?status=${f}`}
            className={`rounded-full px-3 py-1 text-sm capitalize ${f === status ? "bg-accent text-white" : "bg-surface text-ink/80 ring-1 ring-line"}`}
          >
            {f.replace("_", " ")}
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="status" value={status} />
          <input className="input w-60" name="q" defaultValue={q} placeholder="Search name or email" />
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        {rows.length ? (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs tracking-wide text-muted uppercase">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Coach</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3 text-right font-medium">Clients</th>
                <th className="px-5 py-3 text-right font-medium">Sessions 30d</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-bg/60">
                  <td className="px-5 py-3">
                    <Link href={`/coaches/${c.id}`} className="font-medium hover:text-accent">
                      {c.business_name || c.display_name || "Unnamed"}
                    </Link>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className="px-5 py-3">{fmtDate(c.created_at, PORTAL_TZ)}</td>
                  <td className="px-5 py-3">{fmtRelativeDays(c.last_sign_in_at)}</td>
                  <td className="px-5 py-3 text-right">{c.clients_active} / {c.clients_total}</td>
                  <td className="px-5 py-3 text-right">{c.sessions_30d}</td>
                  <td className="px-5 py-3 capitalize">
                    {c.plan}
                    {can("accounts") && c.monthly_price_cents ? <span className="text-muted"> · {money(c.monthly_price_cents)}</span> : null}
                  </td>
                  <td className="px-5 py-3">
                    {c.is_internal ? <Pill status="internal" label="staff test" /> : <Pill status={c.status ?? "trial"} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-5"><Empty>No coaches match.</Empty></div>
        )}
      </div>
    </>
  );
}
