import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Area = "overview" | "coaches" | "accounts" | "notes" | "people" | "access" | "coach_access" | "legal";
export type StaffRole = "owner" | "admin" | "support" | "finance";

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  support: "Support",
  finance: "Finance",
};

export const ROLE_HELP: Record<StaffRole, string> = {
  owner: "Everything, including other owners, opening coach accounts and deleting legal documents.",
  admin: "Everything except changing owners and deleting legal documents.",
  support: "Coaches, internal notes and opening coach accounts. Can't change plans or billing.",
  finance: "Coaches, plans and billing. Can't read internal notes.",
};

export const AREA_LABEL: Record<Area, string> = {
  overview: "Overview",
  coaches: "Coaches",
  accounts: "Plans and billing",
  notes: "Internal notes",
  people: "People",
  access: "Access log",
  coach_access: "Open coach accounts",
  legal: "Legal",
};

/**
 * The signed-in staff member, their role and the areas they can enter.
 * Anyone not on the staff list (or set inactive) is signed out and sent back.
 * An invited address that already had a login is linked here on first visit.
 */
export const getStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    const { data: claimed } = await supabase.rpc("claim_staff_invite");
    if (claimed) isStaff = true;
  }
  if (!isStaff) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("That account doesn't have access to the internal portal.")}`);
  }

  const [{ data: me }, { data: areaRows }] = await Promise.all([
    supabase.from("staff").select("user_id, role, name, email, status, created_at").eq("user_id", user.id).single(),
    supabase.rpc("staff_areas"),
  ]);
  const areas = (areaRows ?? []) as Area[];
  return {
    supabase,
    user,
    me: me as { user_id: string; role: StaffRole; name: string | null; email: string | null; status: string; created_at: string },
    areas,
    can: (a: Area) => areas.includes(a),
  };
});

/** For a page or action that belongs to one area. Refuses at the server, not just in the sidebar. */
export async function requireArea(area: Area) {
  const staff = await getStaff();
  if (!staff.can(area)) redirect(`/?error=${encodeURIComponent(`Your role doesn't include ${AREA_LABEL[area].toLowerCase()}.`)}`);
  return staff;
}

export type CoachRow = {
  id: string;
  email: string | null;
  display_name: string;
  business_name: string;
  booking_slug: string | null;
  timezone: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  monthly_price_cents: number | null;
  clients_total: number;
  clients_active: number;
  arrangements_active: number;
  sessions_30d: number;
  sessions_upcoming: number;
  invoices_total: number;
  offers_total: number;
  last_activity_at: string | null;
  is_internal: boolean;
};

export const PORTAL_TZ = "Australia/Brisbane";
