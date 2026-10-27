import { Banner, Empty, PageHeader, Pill } from "@/components/ui";
import { fmtDate, fmtRelativeDays } from "@/lib/format";
import { AREA_LABEL, PORTAL_TZ, requireArea, ROLE_HELP, ROLE_LABEL, type Area, type StaffRole } from "@/lib/staff";
import { cancelInviteAction, inviteStaffAction, updateStaffAction } from "../../actions";

const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];
const ROLE_AREAS: Record<StaffRole, Area[]> = {
  owner: ["overview", "coaches", "accounts", "notes", "people", "access", "coach_access"],
  admin: ["overview", "coaches", "accounts", "notes", "people", "access", "coach_access"],
  support: ["overview", "coaches", "notes", "coach_access"],
  finance: ["overview", "coaches", "accounts"],
};

type StaffRow = { user_id: string; role: StaffRole; name: string | null; email: string | null; status: string; created_at: string };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; invited?: string }> }) {
  const { error, saved, invited } = await searchParams;
  const { supabase, me } = await requireArea("people");
  const [{ data: staff }, { data: invites }, { data: lastIn }] = await Promise.all([
    supabase.from("staff").select("user_id, role, name, email, status, created_at").order("status").order("created_at"),
    supabase.from("staff_invites").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
    supabase.from("portal_access_log").select("user_id, created_at").eq("event", "Signed in").order("created_at", { ascending: false }).limit(500),
  ]);
  const lastSeen = new Map<string, string>();
  for (const r of lastIn ?? []) if (r.user_id && !lastSeen.has(r.user_id)) lastSeen.set(r.user_id, r.created_at);
  const isOwner = me.role === "owner";
  const assignable = isOwner ? ROLES : ROLES.filter((r) => r !== "owner");

  return (
    <>
      <PageHeader title="People" sub="Who can get into the internal portal, and what their role lets them open." />
      <Banner error={error} message={invited ? `Invitation saved for ${invited}. Send them the join link below.` : saved ? "Saved." : undefined} />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="section-title">Staff</h2>
          <ul className="divide-y divide-line">
            {((staff ?? []) as StaffRow[]).map((p) => {
              const self = p.user_id === me.user_id;
              const locked = self || (p.role === "owner" && !isOwner);
              return (
                <li key={p.user_id} className={`py-3 ${p.status === "inactive" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {p.name || p.email} {self && <span className="text-xs text-muted">(you)</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {p.email} · added {fmtDate(p.created_at, PORTAL_TZ)} · last signed in {fmtRelativeDays(lastSeen.get(p.user_id) ?? null)}
                      </p>
                    </div>
                    {p.status === "inactive" ? <Pill status="cancelled" label="inactive" /> : <Pill status="active" label={ROLE_LABEL[p.role]} />}
                  </div>
                  {!locked && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={updateStaffAction} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <select name="role" defaultValue={p.role} className="input w-40 py-1">
                          {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <button className="btn-ghost btn-sm">Change role</button>
                      </form>
                      <form action={updateStaffAction}>
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <input type="hidden" name="status" value={p.status === "inactive" ? "active" : "inactive"} />
                        <button className="btn-ghost btn-sm">{p.status === "inactive" ? "Reactivate" : "Set inactive"}</button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">Inactive people keep their login but can&apos;t get into the portal. Nobody can change their own role or status, and only an owner can change an owner.</p>
        </section>

        <div className="space-y-5">
          <section className="card">
            <h2 className="section-title">Invite someone</h2>
            <form action={inviteStaffAction} className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input name="name" className="input" />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" className="input" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" className="input" defaultValue="support">
                  {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <button className="btn w-full">Save invitation</button>
            </form>
            <p className="mt-3 text-xs text-muted">
              Then send them <span className="font-medium text-ink">/join</span> on this portal&apos;s address. If they already have a login (for example, they also coach), they just sign in and the role is linked.
            </p>
          </section>

          {invites?.length ? (
            <section className="card">
              <h2 className="section-title">Waiting to join</h2>
              <ul className="space-y-2 text-sm">
                {invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between gap-2">
                    <span>
                      {i.name || i.email}
                      <span className="block text-xs text-muted">{ROLE_LABEL[i.role as StaffRole]} · {fmtDate(i.created_at, PORTAL_TZ)}</span>
                    </span>
                    <form action={cancelInviteAction}>
                      <input type="hidden" name="email" value={i.email} />
                      <button className="btn-ghost btn-sm">Cancel</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card">
            <h2 className="section-title">Roles</h2>
            <ul className="space-y-3 text-sm">
              {ROLES.map((r) => (
                <li key={r}>
                  <p className="font-medium">{ROLE_LABEL[r]}</p>
                  <p className="text-xs text-muted">{ROLE_HELP[r]}</p>
                  <p className="mt-0.5 text-xs text-muted">{ROLE_AREAS[r].map((a) => AREA_LABEL[a]).join(" · ")}</p>
                </li>
              ))}
            </ul>
            {!(staff ?? []).length && <Empty>No staff.</Empty>}
          </section>
        </div>
      </div>
    </>
  );
}
