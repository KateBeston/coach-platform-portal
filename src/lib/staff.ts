import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

/** Signed-in staff member. Anyone who isn't on the staff list is sent back to sign in. */
export const getStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("That account doesn't have access to the internal portal.")}`);
  }
  return { supabase, user };
});

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
