import Link from "next/link";
import { Empty, PageHeader, Pill, Stat } from "@/components/ui";
import { usd } from "@/lib/email-kinds";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ, requireArea, type CoachRow } from "@/lib/staff";

/** ISO timestamp for the first of this month and 30 days ago. */
function since() {
  const now = new Date();
  return { month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), d30: new Date(now.getTime() - 30 * 86_400_000).toISOString() };
}

export default async function PlatformAiPage({ searchParams }: { searchParams: Promise<{ coach?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireArea("coaches");
  const { month, d30 } = since();
  let q = supabase.from("ai_usage").select("*").gte("created_at", d30).order("created_at", { ascending: false }).limit(500);
  if (sp.coach) q = q.eq("coach_id", sp.coach);
  const [{ data: rows }, { data: coaches }] = await Promise.all([q, supabase.rpc("admin_coaches")]);
  const all = rows ?? [];
  const names = new Map(((coaches ?? []) as CoachRow[]).map((c) => [c.id, c.business_name || c.display_name || c.email || "Coach"]));
  const thisMonth = all.filter((r) => r.created_at >= month);
  const cost = (xs: typeof all) => xs.reduce((t, r) => t + Number(r.cost_usd), 0);
  const byCoach = new Map<string, { n: number; cost: number; failed: number }>();
  for (const r of all) {
    const x = byCoach.get(r.coach_id) ?? { n: 0, cost: 0, failed: 0 };
    x.n++;
    x.cost += Number(r.cost_usd);
    if (!r.ok) x.failed++;
    byCoach.set(r.coach_id, x);
  }
  const ranked = [...byCoach.entries()].sort((a, b) => b[1].cost - a[1].cost);

  return (
    <>
      <PageHeader title="AI usage" sub="Every AI request coaches make, what it was for, and roughly what it cost. Last 30 days." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests this month" value={String(thisMonth.length)} />
        <Stat label="Cost this month" value={usd(cost(thisMonth))} hint="Approximate, in US dollars" />
        <Stat label="Requests, 30 days" value={String(all.length)} />
        <Stat label="Didn't work, 30 days" value={String(all.filter((r) => !r.ok).length)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="section-title">By coach</h2>
          {ranked.length ? (
            <ul className="divide-y divide-line text-sm">
              {ranked.map(([id, x]) => (
                <li key={id} className="flex items-center justify-between py-2">
                  <Link href={`/platform/ai?coach=${id}`} className="hover:text-accent">{names.get(id) ?? "Coach"}</Link>
                  <span className="text-muted">{x.n} · {usd(x.cost)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No AI use yet.</Empty>
          )}
          {sp.coach && <Link href="/platform/ai" className="mt-3 inline-block text-sm text-accent hover:underline">Show all coaches</Link>}
        </section>
        <section className="card p-0 lg:col-span-2">
          {all.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Coach</th>
                  <th className="px-5 py-3 font-medium">For</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens</th>
                  <th className="px-5 py-3 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2 whitespace-nowrap text-muted">{fmtDateTime(r.created_at, PORTAL_TZ)}</td>
                    <td className="px-5 py-2">{names.get(r.coach_id) ?? "Coach"}</td>
                    <td className="px-5 py-2">
                      {r.detail ?? r.feature} {!r.ok && <Pill status="past_due" label="failed" />}
                      {r.error && <p className="text-xs text-muted">{r.error}</p>}
                    </td>
                    <td className="px-5 py-2 text-right text-muted">{r.input_tokens + r.output_tokens}</td>
                    <td className="px-5 py-2 text-right">{usd(r.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-5"><Empty>No AI requests in the last 30 days.</Empty></div>
          )}
        </section>
      </div>
    </>
  );
}
