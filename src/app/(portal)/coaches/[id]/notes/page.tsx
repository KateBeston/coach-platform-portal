import { Banner, Empty } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ, requireArea } from "@/lib/staff";
import { addNoteAction } from "../../../actions";

const NOTE_KINDS = ["note", "support", "feedback", "call", "billing"];

export default async function CoachNotes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; kind?: string }> }) {
  const { id } = await params;
  const { error, kind } = await searchParams;
  await requireArea("notes");
  const { supabase } = await getCoachRecord(id);
  let q = supabase.from("admin_notes").select("*").eq("coach_id", id).order("created_at", { ascending: false });
  if (kind && NOTE_KINDS.includes(kind)) q = q.eq("kind", kind);
  const [{ data: notes }, { data: staff }] = await Promise.all([q, supabase.from("staff").select("user_id, name, email")]);
  const who = new Map((staff ?? []).map((s) => [s.user_id, s.name || s.email]));

  return (
    <section className="card">
      <Banner error={error} />
      <form action={addNoteAction} className="mb-5 space-y-2">
        <input type="hidden" name="coach_id" value={id} />
        <div className="flex gap-2">
          <select name="kind" className="input w-36">
            {NOTE_KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
          </select>
          <button className="btn">Add note</button>
        </div>
        <textarea name="body" className="input min-h-20" placeholder="Support request, feedback, a call, a billing change…" required />
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
        {["", ...NOTE_KINDS].map((k) => (
          <a key={k || "all"} href={`/coaches/${id}/notes${k ? `?kind=${k}` : ""}`} className={`rounded-full px-2.5 py-1 capitalize ring-1 ${(kind ?? "") === k ? "bg-accent text-white ring-accent" : "ring-line hover:ring-accent"}`}>
            {k || "All"}
          </a>
        ))}
      </div>
      {notes?.length ? (
        <ul className="space-y-4">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-line pl-3">
              <p className="text-xs text-muted capitalize">{n.kind} · {fmtDateTime(n.created_at, PORTAL_TZ)}{n.created_by && who.get(n.created_by) ? ` · ${who.get(n.created_by)}` : ""}</p>
              <p className="mt-1 text-sm whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No notes yet.</Empty>
      )}
    </section>
  );
}
