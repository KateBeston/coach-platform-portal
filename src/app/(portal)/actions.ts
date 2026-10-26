"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function updateAccountAction(fd: FormData) {
  const { supabase } = await getStaff();
  const id = s(fd, "coach_id");
  const price = s(fd, "monthly_price");
  const { error } = await supabase
    .from("coach_accounts")
    .upsert({
      coach_id: id,
      plan: s(fd, "plan") || "trial",
      status: s(fd, "status") || "trial",
      trial_ends_at: s(fd, "trial_ends_at") || null,
      monthly_price_cents: price ? Math.round(Number(price) * 100) : 0,
      source: s(fd, "source") || null,
      updated_at: new Date().toISOString(),
    });
  if (error) redirect(`/coaches/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/coaches/${id}`);
  revalidatePath("/");
  redirect(`/coaches/${id}?saved=1`);
}

export async function addNoteAction(fd: FormData) {
  const { supabase } = await getStaff();
  const id = s(fd, "coach_id");
  const body = s(fd, "body");
  if (body) {
    const { error } = await supabase.from("admin_notes").insert({ coach_id: id, kind: s(fd, "kind") || "note", body });
    if (error) redirect(`/coaches/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/coaches/${id}`);
  redirect(`/coaches/${id}`);
}
