import { Empty, Pill } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDate } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", practitioner: "Practitioner" };
const EMPLOYMENT: Record<string, string> = { owner: "Owner", in_house: "In-house", subcontractor: "Subcontractor" };

export default async function CoachTeam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getCoachRecord(id);
  const { data } = await supabase.rpc("admin_coach_team", { p_coach: id });
  const team = (data ?? []) as { name: string; email: string | null; role: string; employment: string; active: boolean; signed_up: boolean; created_at: string }[];

  return (
    <section className="card">
      <h2 className="section-title">Team · {team.filter((t) => t.active).length} active</h2>
      {team.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Role</th><th className="pb-2 font-medium">Engaged as</th><th className="pb-2 font-medium">Login</th><th className="pb-2 font-medium">Added</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {team.map((t, i) => (
                <tr key={i} className={t.active ? "" : "opacity-50"}>
                  <td className="py-2"><p className="font-medium">{t.name}</p>{t.email && <p className="text-xs text-muted">{t.email}</p>}</td>
                  <td className="py-2">{ROLE[t.role] ?? t.role}</td>
                  <td className="py-2">{EMPLOYMENT[t.employment] ?? t.employment}</td>
                  <td className="py-2">{t.signed_up ? <Pill status="active" label="signed up" /> : <Pill status="trial" label="invited" />}</td>
                  <td className="py-2 text-muted">{fmtDate(t.created_at, PORTAL_TZ)}{!t.active && " · inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No team members.</Empty>
      )}
      <p className="mt-4 text-xs text-muted">Names and roles only. Pay rates and client assignments stay inside the coach&apos;s own account.</p>
    </section>
  );
}
