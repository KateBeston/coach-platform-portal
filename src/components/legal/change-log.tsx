"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { explainChange } from "@/app/(portal)/legal/actions";
import { useSaveState } from "@/components/save-state";
import { CHANGE_TYPE, NEEDS_REASON } from "@/lib/legal";
import { Note, Tag } from "./fields";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function ChangeLog({ entries, unexplained, filter }: { entries: Row[]; unexplained: number; filter: string }) {
  const { report } = useSaveState();
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      report("saving");
      const res = await fn();
      report(res.ok ? "saved" : "error", res.ok ? undefined : res.error);
      router.refresh();
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Change history</h1>
          <p className="mt-1 text-sm text-muted">
            {entries.length} entries{unexplained > 0 && ` · ${unexplained} with no reason recorded`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className={filter === "all" ? "btn" : "btn-ghost"} href="/legal/changes">Everything</Link>
          <Link className={filter === "unexplained" ? "btn" : "btn-ghost"} href="/legal/changes?filter=unexplained">
            Needs a reason {unexplained > 0 && `· ${unexplained}`}
          </Link>
        </div>
      </div>
      <Note>
        <strong>What changed is recorded automatically. Why it changed isn&apos;t.</strong>
      </Note>
      {!entries.length && (
        <p className="text-sm text-muted">{filter === "unexplained" ? "Nothing outstanding — every significant change has a reason recorded." : "No changes recorded yet. Everything from here is logged automatically."}</p>
      )}
      <div className="space-y-2">
        {entries.map((e) => {
          const t = CHANGE_TYPE[e.change_type] ?? { label: e.change_type, tone: "plain" as const };
          const needsReason = NEEDS_REASON.includes(e.change_type) && !e.reason;
          const isOpen = open === e.id;
          const when = new Date(e.changed_at);
          return (
            <div key={e.id} className={`card p-4 ${needsReason ? "border-l-4 border-l-warn" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-4">
                  <div className="min-w-24 text-xs text-muted tabular-nums">
                    {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Brisbane" }).format(when)}
                    <div>{new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(when)}</div>
                  </div>
                  <div>
                    <p className="font-medium">{e.summary ?? t.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <Tag tone={t.tone}>{t.label}</Tag>{" "}
                      {e.legal_document_id ? (
                        <Link href={`/legal/${e.legal_document_id}`} className="text-accent hover:underline">{e.legal_documents?.name ?? "Document"}</Link>
                      ) : (
                        "Deleted document"
                      )}
                      {e.legal_documents?.requires_acceptance && " · people accept this"}
                      {e.changed_by && ` · ${e.changed_by}`}
                    </p>
                    {e.reason && (
                      <p className="mt-1 text-sm text-muted italic">
                        {e.reason}
                        {e.prompted_by && ` — prompted by ${e.prompted_by}`}
                        {e.reference && ` (${e.reference})`}
                      </p>
                    )}
                    {e.field_name && e.old_value !== e.new_value && (
                      <p className="mt-1 max-w-xl text-xs text-muted">
                        {e.old_value ? <>was <em>{String(e.old_value).slice(0, 90)}</em> · </> : <>was empty · </>}
                        now <em>{String(e.new_value ?? "").slice(0, 90) || "empty"}</em>
                      </p>
                    )}
                  </div>
                </div>
                <button className="text-sm text-accent hover:underline" onClick={() => setOpen(isOpen ? null : e.id)}>
                  {isOpen ? "Close" : e.reason ? "Edit reason" : "Add reason"}
                </button>
              </div>
              {isOpen && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Reason for the change</label>
                    <textarea
                      className="input min-h-20"
                      defaultValue={e.reason ?? ""}
                      placeholder="The basis for the change"
                      onBlur={(ev) => ev.target.value !== (e.reason ?? "") && act(() => explainChange(e.id, e.legal_document_id, "reason", ev.target.value || null))}
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Prompted by</label>
                      <input
                        className="input"
                        defaultValue={e.prompted_by ?? ""}
                        placeholder="Lawyer's advice, a complaint, a regulation"
                        onBlur={(ev) => ev.target.value !== (e.prompted_by ?? "") && act(() => explainChange(e.id, e.legal_document_id, "prompted_by", ev.target.value || null))}
                      />
                    </div>
                    <div>
                      <label className="label">Reference</label>
                      <input
                        className="input"
                        defaultValue={e.reference ?? ""}
                        placeholder="Advice dated, ticket number, section"
                        onBlur={(ev) => ev.target.value !== (e.reference ?? "") && act(() => explainChange(e.id, e.legal_document_id, "reference", ev.target.value || null))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
