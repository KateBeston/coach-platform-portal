import { Banner } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ, requireArea } from "@/lib/staff";
import { updateAccountAction } from "../../../actions";

export default async function CoachAccount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  await requireArea("accounts");
  const { supabase } = await getCoachRecord(id);
  const { data: account } = await supabase.from("coach_accounts").select("*").eq("coach_id", id).maybeSingle();

  return (
    <section className="card max-w-lg">
      <Banner error={error} message={saved ? "Saved." : undefined} />
      <h2 className="section-title">Plan and billing</h2>
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
        <button className="btn">Save</button>
        {account?.updated_at && <p className="text-xs text-muted">Updated {fmtDateTime(account.updated_at, PORTAL_TZ)}</p>}
      </form>
    </section>
  );
}
