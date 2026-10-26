import { notFound } from "next/navigation";
import { cache } from "react";
import { requireArea, type CoachRow } from "./staff";

/** One coach's summary row, shared by the record's layout and its tabs within a request. */
export const getCoachRecord = cache(async (id: string) => {
  const staff = await requireArea("coaches");
  const { data } = await staff.supabase.rpc("admin_coaches");
  const c = ((data ?? []) as CoachRow[]).find((x) => x.id === id);
  if (!c) notFound();
  return { ...staff, c, name: c.business_name || c.display_name || c.email || "Coach" };
});
