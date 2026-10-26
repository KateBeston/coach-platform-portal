import { AccessTable, type AccessRow } from "@/components/access-table";
import { PageHeader, Stat } from "@/components/ui";
import { requireArea } from "@/lib/staff";

/** ISO timestamp seven days back. */
function weekAgo() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const { supabase } = await requireArea("access");
  const since = weekAgo();
  let q = supabase.from("portal_access_log").select("*").order("created_at", { ascending: false }).limit(200);
  if (show === "failed") q = q.eq("event", "Failed");
  const [{ data: rows }, { count: failed7 }, { count: in7 }] = await Promise.all([
    q,
    supabase.from("portal_access_log").select("*", { count: "exact", head: true }).eq("event", "Failed").gte("created_at", since),
    supabase.from("portal_access_log").select("*", { count: "exact", head: true }).eq("event", "Signed in").gte("created_at", since),
  ]);

  return (
    <>
      <PageHeader
        title="Access log"
        sub="Every sign-in, sign-out, time-out and failed attempt on the internal portal."
        action={
          <div className="flex gap-1.5 text-sm">
            <a href="/settings/access" className={show ? "btn-ghost btn-sm" : "btn btn-sm"}>Everything</a>
            <a href="/settings/access?show=failed" className={show ? "btn btn-sm" : "btn-ghost btn-sm"}>Failed only</a>
          </div>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Stat label="Sign-ins, 7 days" value={String(in7 ?? 0)} />
        <Stat label="Failed attempts, 7 days" value={String(failed7 ?? 0)} hint="Four in fifteen minutes slows an address; eight blocks it for fifteen minutes." />
      </div>
      <section className="card">
        <AccessTable rows={(rows ?? []) as AccessRow[]} />
      </section>
    </>
  );
}
