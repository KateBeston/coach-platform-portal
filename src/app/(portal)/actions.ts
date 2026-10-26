"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireArea, type StaffRole } from "@/lib/staff";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (path: string, error: string) => redirect(`${path}?error=${encodeURIComponent(error)}`);
const ROLES: StaffRole[] = ["owner", "admin", "support", "finance"];

export async function updateAccountAction(fd: FormData) {
  const { supabase } = await requireArea("accounts");
  const id = s(fd, "coach_id");
  const path = `/coaches/${id}/account`;
  const price = s(fd, "monthly_price");
  const { error } = await supabase.from("coach_accounts").upsert({
    coach_id: id,
    plan: s(fd, "plan") || "trial",
    status: s(fd, "status") || "trial",
    trial_ends_at: s(fd, "trial_ends_at") || null,
    monthly_price_cents: price ? Math.round(Number(price) * 100) : 0,
    source: s(fd, "source") || null,
    updated_at: new Date().toISOString(),
  });
  if (error) back(path, error.message);
  revalidatePath(`/coaches/${id}`, "layout");
  revalidatePath("/");
  redirect(`${path}?saved=1`);
}

export async function addNoteAction(fd: FormData) {
  const { supabase } = await requireArea("notes");
  const id = s(fd, "coach_id");
  const body = s(fd, "body");
  if (body) {
    const { error } = await supabase.from("admin_notes").insert({ coach_id: id, kind: s(fd, "kind") || "note", body });
    if (error) back(`/coaches/${id}/notes`, error.message);
  }
  revalidatePath(`/coaches/${id}`, "layout");
  redirect(`/coaches/${id}/notes`);
}

// ── People ────────────────────────────────────────────────────────────────

export async function inviteStaffAction(fd: FormData) {
  const { supabase } = await requireArea("people");
  const email = s(fd, "email").toLowerCase();
  const role = s(fd, "role") as StaffRole;
  if (!email || !ROLES.includes(role)) back("/settings/people", "An email and a role are needed.");
  const { data: existing } = await supabase.from("staff").select("user_id").ilike("email", email).maybeSingle();
  if (existing) back("/settings/people", "That address is already on the staff list.");
  const { error } = await supabase
    .from("staff_invites")
    .upsert({ email, role, name: s(fd, "name") || null, accepted_at: null, created_at: new Date().toISOString() });
  if (error) back("/settings/people", error.message);
  revalidatePath("/settings/people");
  redirect(`/settings/people?invited=${encodeURIComponent(email)}`);
}

export async function cancelInviteAction(fd: FormData) {
  const { supabase } = await requireArea("people");
  const { error } = await supabase.from("staff_invites").delete().eq("email", s(fd, "email"));
  if (error) back("/settings/people", error.message);
  revalidatePath("/settings/people");
  redirect("/settings/people");
}

export async function updateStaffAction(fd: FormData) {
  const { supabase } = await requireArea("people");
  const patch: Record<string, string | null> = {};
  if (fd.has("name")) patch.name = s(fd, "name") || null;
  if (fd.has("role")) {
    const role = s(fd, "role") as StaffRole;
    if (!ROLES.includes(role)) back("/settings/people", "Unknown role.");
    patch.role = role;
  }
  if (fd.has("status")) patch.status = s(fd, "status") === "inactive" ? "inactive" : "active";
  const { error } = await supabase.from("staff").update(patch).eq("user_id", s(fd, "user_id"));
  if (error) back("/settings/people", error.message.replace(/^.*?:\s*/, ""));
  revalidatePath("/settings/people");
  redirect("/settings/people?saved=1");
}

export async function updateMyNameAction(fd: FormData) {
  const { supabase, user } = await requireArea("overview");
  const { error } = await supabase.from("staff").update({ name: s(fd, "name") || null }).eq("user_id", user.id);
  if (error) back("/account", error.message);
  revalidatePath("/", "layout");
  redirect("/account?saved=1");
}
