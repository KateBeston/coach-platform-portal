import Link from "next/link";
import { Empty, Pill } from "@/components/ui";
import { EMAIL_KIND } from "@/lib/email-kinds";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

type Row = { id: string; kind: string; to_email: string; to_name: string | null; subject: string | null; body_text: string | null; status: string; status_note: string | null; created_at: string; sent_at: string | null; coach_id: string };

/** A list of emails with the selected one shown in full. */
export function EmailList({ rows, open, hrefFor, coachNames }: { rows: Row[]; open?: string; hrefFor: (id: string) => string; coachNames?: Map<string, string> }) {
  const sel = rows.find((r) => r.id === open);
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="card p-0 lg:col-span-3">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={hrefFor(r.id)} className={`block px-5 py-3 hover:bg-bg/60 ${open === r.id ? "bg-accent-soft/40" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.subject ?? EMAIL_KIND[r.kind]}</p>
                      <p className="text-xs text-muted">
                        {coachNames && <>{coachNames.get(r.coach_id) ?? "Coach"} · </>}
                        {EMAIL_KIND[r.kind] ?? r.kind} · to {r.to_email}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {r.status === "sent" ? <Pill status="active" label="sent" /> : r.status === "failed" ? <Pill status="past_due" label="didn't send" /> : r.status === "skipped" ? <Pill status="cancelled" label="not needed" /> : <Pill status="trial" label="waiting" />}
                      <p className="mt-1 text-xs text-muted">{fmtDateTime(r.sent_at ?? r.created_at, PORTAL_TZ)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><Empty>No emails here.</Empty></div>
        )}
      </section>
      <section className="card h-fit lg:col-span-2">
        {sel ? (
          <>
            <p className="text-xs text-muted">{EMAIL_KIND[sel.kind]} · to {sel.to_name ? `${sel.to_name} (${sel.to_email})` : sel.to_email}</p>
            <h2 className="mt-1 mb-3 font-serif text-xl">{sel.subject ?? "Not written yet"}</h2>
            {sel.body_text ? <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{sel.body_text}</pre> : <p className="text-sm text-muted">Written at the moment it sends, so it always has the latest details.</p>}
            {sel.status_note && <p className="mt-4 rounded-xl bg-stone-soft px-3 py-2 text-xs text-muted">{sel.status_note}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Pick an email to see exactly what it said.</p>
        )}
      </section>
    </div>
  );
}
