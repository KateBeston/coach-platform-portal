import Link from "next/link";
import { AccessTable, type AccessRow } from "@/components/access-table";
import { Banner, PageHeader } from "@/components/ui";
import { AREA_LABEL, getStaff, ROLE_HELP, ROLE_LABEL } from "@/lib/staff";
import { updateMyNameAction } from "../actions";

export default async function MyAccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { supabase, user, me, areas } = await getStaff();
  const { data: rows } = await supabase.from("portal_access_log").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);

  return (
    <>
      <PageHeader title="My account" sub={user.email ?? undefined} />
      <Banner error={error} message={saved ? "Saved." : undefined} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <section className="card">
            <h2 className="section-title">Name</h2>
            <form action={updateMyNameAction} className="flex gap-2">
              <input name="name" className="input" defaultValue={me.name ?? ""} placeholder="How you appear on notes" />
              <button className="btn">Save</button>
            </form>
          </section>
          <section className="card">
            <h2 className="section-title">Role</h2>
            <p className="font-medium">{ROLE_LABEL[me.role]}</p>
            <p className="text-sm text-muted">{ROLE_HELP[me.role]}</p>
            <p className="mt-2 text-xs text-muted">{areas.map((a) => AREA_LABEL[a]).join(" · ")}</p>
          </section>
          <section className="card">
            <h2 className="section-title">Password</h2>
            <p className="mb-3 text-sm text-muted">Change it by sending yourself a reset link.</p>
            <Link href="/forgot" className="btn-ghost">Send a reset link</Link>
          </section>
        </div>
        <section className="card lg:col-span-2">
          <h2 className="section-title">My recent sign-ins</h2>
          <AccessTable rows={(rows ?? []) as AccessRow[]} showEmail={false} />
          <p className="mt-3 text-xs text-muted">If anything here isn&apos;t you, reset your password and tell an owner.</p>
        </section>
      </div>
    </>
  );
}
