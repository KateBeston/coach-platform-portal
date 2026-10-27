"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addChangeNote, addFileByUrl, archiveLegalDocument, createVersion, deleteLegalDocument, deleteLegalFile, deleteVersion,
  explainChange, makeCurrent, openLegalFile, restoreLegalDocument, saveLegalDocument, saveLegalFile, saveVersion, uploadLegalFile,
} from "@/app/(portal)/legal/actions";
import { useSaveState } from "@/components/save-state";
import {
  ACCEPT_LEGAL, auDate, CATEGORIES, CHANGE_TYPE, detectFormat, DOC_STATUS, FILE_KINDS, humanSize, isArchive, NEEDS_REASON, nextVersionLabel,
  SENSITIVITY, TYPES,
} from "@/lib/legal";
import { D, F, Note, Tag } from "./fields";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function LegalDocumentEditor({
  doc, versions, files, acceptances, changes, access, isOwner, appUrl, website,
}: {
  doc: Row; versions: Row[]; files: Row[]; acceptances: number; changes: Row[]; access: Row[];
  /** Deleting is owner level only. Everything else, archiving included, is reversible. */
  isOwner: boolean; appUrl: string; website: string | null;
}) {
  const { report } = useSaveState();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [archiveWhy, setArchiveWhy] = useState("");
  const [deleteWhy, setDeleteWhy] = useState("");
  const [openVersion, setOpenVersion] = useState<number | null>(versions.find((v) => v.is_current)?.id ?? versions[0]?.id ?? null);
  const [note, setNote] = useState({ summary: "", reason: "", prompted: "" });
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      report("saving");
      const res = await fn();
      setMsg(res.ok ? (res.message ? { ok: true, text: res.message } : null) : { ok: false, text: res.error ?? "Didn't save." });
      report(res.ok ? "saved" : "error", res.ok ? undefined : "Didn't save");
      router.refresh();
    });

  const save = (col: string, v: unknown) => act(() => saveLegalDocument(doc.id, col, v));
  const current = versions.find((v) => v.is_current);
  const status = DOC_STATUS.find((s) => s.key === doc.doc_status);
  const unexplained = changes.filter((c) => NEEDS_REASON.includes(c.change_type) && !c.reason).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{doc.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {doc.document_type} · {doc.category ?? "uncategorised"}
            {current?.effective_from && ` · in force since ${auDate(current.effective_from)}`}
            {acceptances > 0 && ` · ${acceptances} acceptances recorded`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            defaultValue={doc.doc_status}
            disabled={pending}
            className={`input w-auto font-medium ${status?.tone ?? ""}`}
            title={status?.note}
            onChange={(e) => save("doc_status", e.target.value)}
          >
            {DOC_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select defaultValue={doc.sensitivity} disabled={pending} className="input w-auto" onChange={(e) => save("sensitivity", e.target.value)}>
            {SENSITIVITY.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Link className="btn-ghost" href={`/legal-print/${doc.id}`} target="_blank">Print &amp; export</Link>
          <Tag tone={doc.is_published ? "accent" : "plain"} disabled={pending} onClick={() => save("is_published", !doc.is_published)}>
            {doc.is_published ? "Published" : "Draft"}
          </Tag>
        </div>
      </div>

      {msg && <Note tone={msg.ok ? undefined : "bad"}>{msg.text}</Note>}

      {acceptances > 0 && (
        <Note>
          <strong>{acceptances} {acceptances === 1 ? "person has" : "people have"} accepted this document.</strong> Revising it creates a new version — the wording they agreed to keeps its text
          and gains an end date, so it can still be produced if it&apos;s ever questioned.
        </Note>
      )}
      {doc.needs_attention && (
        <Note tone="warn">
          <strong>Needs a look:</strong> {doc.needs_attention}
        </Note>
      )}

      {/* ── details ── */}
      <section className="card mb-5">
        <h2 className="section-title">Details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Name" initial={doc.name} onSave={(v) => save("name", v)} />
          <F label="Slug" initial={doc.slug} onSave={(v) => save("slug", v)} help={doc.is_published ? "Locked while published — unpublish to change it" : "Becomes the public address. Permanent once published."} />
          <div>
            <label className="label">Who it applies to</label>
            <select defaultValue={doc.document_type} className="input" onChange={(e) => save("document_type", e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select defaultValue={doc.category ?? ""} className="input" onChange={(e) => save("category", e.target.value || null)}>
              <option value="">Uncategorised</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <F label="Jurisdiction" initial={doc.jurisdiction} onSave={(v) => save("jurisdiction", v)} />
          <D label="Review due" initial={doc.review_due} onSave={(v) => save("review_due", v)} help="A prompt to re-read it, not a legal deadline" />
        </div>
        <div className="mt-3 grid gap-3">
          <F label="Summary" textarea initial={doc.summary} onSave={(v) => save("summary", v)} help="Internal — what this document is for and when it applies" />
          <F
            label="Where it's used"
            initial={(doc.used_on ?? []).join(", ")}
            onSave={(v) => save("used_on", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null)}
            help="Comma separated, so a change can be traced to what it affects."
          />
          <F label="Note" textarea initial={doc.owner_note} onSave={(v) => save("owner_note", v)} help="Anything to remember — questions for your lawyer, points still unresolved" />
          <F label="Needs attention" initial={doc.needs_attention} onSave={(v) => save("needs_attention", v)} help="Shown at the top of the register until cleared" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Tag tone={doc.requires_acceptance ? "accent" : "plain"} disabled={pending} onClick={() => save("requires_acceptance", !doc.requires_acceptance)}>
            {doc.requires_acceptance ? "Must be accepted" : "Read only"}
          </Tag>
          <span className="text-xs text-muted">
            Acceptance records who agreed, to which version, and when.{doc.document_type === "Coach" && " Coach documents are accepted at sign-up once published."}
          </span>
        </div>
      </section>

      {/* ── wording (versions) ── */}
      <section className="card mb-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="section-title mb-0">Wording</h2>
            <p className="text-sm text-muted">{versions.length ? `${versions.length} version${versions.length === 1 ? "" : "s"}` : "Not written yet"}</p>
          </div>
          <button
            className="btn-ghost"
            disabled={pending}
            onClick={() => act(() => createVersion(doc.id, nextVersionLabel(versions.map((v) => v.version_label)), new Date().toISOString().slice(0, 10)))}
          >
            New version
          </button>
        </div>

        {!versions.length && <Note>No wording yet. Create a version, then paste or write the text — it&apos;s edited here rather than in the website, so a change doesn&apos;t need a redeploy.</Note>}

        <div className="space-y-3">
          {versions.map((v) => {
            const isOpen = openVersion === v.id;
            return (
              <div key={v.id} className={`rounded-xl border border-line p-4 ${v.is_current ? "border-l-4 border-l-accent" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg">
                      {v.version_label ?? "Untitled version"} {v.is_current && <Tag tone="accent">In force</Tag>}
                    </p>
                    <p className="text-xs text-muted">
                      {v.effective_from ? `From ${auDate(v.effective_from)}` : "No start date"}
                      {v.effective_to && ` to ${auDate(v.effective_to)}`}
                      {v.body && ` · ${String(v.body).length.toLocaleString("en-AU")} characters`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {!v.is_current && (
                      <button className="text-accent hover:underline" disabled={pending} onClick={() => act(() => makeCurrent(v.id, doc.id))}>
                        Put in force
                      </button>
                    )}
                    <button className="text-accent hover:underline" onClick={() => setOpenVersion(isOpen ? null : v.id)}>{isOpen ? "Close" : "Edit"}</button>
                    {!v.is_current && isOwner && (
                      <button
                        className="text-danger hover:underline"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Delete ${v.version_label ?? "this version"}?\n\nThe wording goes with it. If anyone has accepted this version it will be refused.`)) return;
                          act(() => deleteVersion(v.id, doc.id));
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <F label="Label" initial={v.version_label} onSave={(x) => act(() => saveVersion(v.id, doc.id, "version_label", x))} />
                      <D label="Effective from" initial={v.effective_from} onSave={(x) => act(() => saveVersion(v.id, doc.id, "effective_from", x))} />
                      <F label="Approved by" initial={v.approved_by} onSave={(x) => act(() => saveVersion(v.id, doc.id, "approved_by", x))} />
                      <F label="What changed" initial={v.change_summary} onSave={(x) => act(() => saveVersion(v.id, doc.id, "change_summary", x))} />
                    </div>
                    <div className="mt-3">
                      <label className="label">Text</label>
                      <textarea
                        className="input min-h-[340px] leading-relaxed"
                        defaultValue={v.body ?? ""}
                        onBlur={(e) => e.target.value !== (v.body ?? "") && act(() => saveVersion(v.id, doc.id, "body", e.target.value || null))}
                      />
                      <p className="mt-1 text-xs text-muted">Markdown or plain text. Saved when you click away. Wording someone has accepted can&apos;t be edited — start a new version.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── where it's read ── */}
      <section className="card mb-5">
        <h2 className="section-title">On the website and in the coach app</h2>
        <Note>
          <strong>The wording lives here, not in the website.</strong> The website and the coach app read it over a link, so revising a policy is an edit on this page rather than a redeploy.
        </Note>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="w-36 text-muted">Public address</dt>
            <dd>{website ? `${website.replace(/\/$/, "")}/legal/${doc.slug}` : <span className="text-muted">Set your website in Legal entity on the register</span>}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="w-36 text-muted">The site reads</dt>
            <dd className="break-all">{appUrl}/api/legal/{doc.slug}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="w-36 text-muted">Formats</dt>
            <dd className="space-x-2">
              {["json", "html", "md", "txt"].map((f) => (
                <a key={f} className="text-accent hover:underline" href={`/api/legal/${doc.slug}?format=${f}`} target="_blank" rel="noopener">
                  {f === "json" ? "JSON" : f === "html" ? "HTML" : f === "md" ? "Markdown" : "Plain text"}
                </a>
              ))}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">Only published documents with wording in force are served. Drafts return nothing.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <F label="Meta title" initial={doc.meta_title} onSave={(v) => save("meta_title", v)} help="For the public page. Leave blank to use the document name." />
          <F label="Meta description" initial={doc.meta_description} onSave={(v) => save("meta_description", v)} />
        </div>
      </section>

      {/* ── files ── */}
      <section className="card mb-5">
        <h2 className="section-title mb-0">Files</h2>
        <p className="mb-4 text-sm text-muted">The artefact rather than the text — a signed copy, a counter-signed agreement, advice</p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="btn-ghost cursor-pointer">
            Upload a file
            <input
              type="file"
              hidden
              disabled={pending}
              accept={ACCEPT_LEGAL}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("legal_document_id", String(doc.id));
                fd.set("file_kind", "Reference");
                fd.set("file", file);
                e.target.value = "";
                act(() => uploadLegalFile(fd));
              }}
            />
          </label>
          <div className="w-44">
            <label className="label">Or paste a link to it</label>
            <input className="input" value={urlName} placeholder="Name" onChange={(e) => setUrlName(e.target.value)} />
          </div>
          <div className="min-w-56 flex-1">
            <input className="input" value={urlValue} placeholder="https://…" onChange={(e) => setUrlValue(e.target.value)} />
          </div>
          <button
            className="btn-ghost"
            disabled={pending || !urlValue.trim()}
            onClick={() =>
              act(async () => {
                const res = await addFileByUrl(doc.id, urlValue, urlName, "Reference");
                if (res.ok) {
                  setUrlValue("");
                  setUrlName("");
                }
                return res;
              })
            }
          >
            Add link
          </button>
        </div>
        <Note>
          <strong>Opening a file is recorded.</strong> Who opened it, when, and which file — kept permanently and not editable.
          {doc.sensitivity === "Privileged" && " This document is privileged, so its files are visible to owners only."}
        </Note>
        {!files.length ? (
          <p className="text-sm text-muted">No files. PDF, Word, spreadsheets, text, images, archives and signature files are all accepted, up to 25 MB each.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">File</th>
                  <th className="py-2 font-medium">Kind</th>
                  <th className="py-2 font-medium">Signed by</th>
                  <th className="py-2 font-medium">Signed</th>
                  <th className="py-2 font-medium">Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        className="text-left font-medium text-accent hover:underline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await openLegalFile(f.id);
                            if (res.ok) window.open(res.url, "_blank", "noopener");
                            else setMsg({ ok: false, text: res.error });
                            router.refresh();
                          })
                        }
                      >
                        {f.file_name}
                      </button>
                      <p className="text-xs text-muted">
                        {f.external_url && !f.storage_path ? "Link" : detectFormat(f.file_name, f.mime_type)?.label ?? "File"}
                        {f.file_size_bytes ? ` · ${humanSize(f.file_size_bytes)}` : ""}
                      </p>
                      {isArchive(f.file_name, f.mime_type) && (
                        <input
                          className={`input mt-1 text-xs ${/^Not described/.test(f.archive_contents ?? "") ? "border-warn" : ""}`}
                          defaultValue={/^Not described/.test(f.archive_contents ?? "") ? "" : (f.archive_contents ?? "")}
                          placeholder="What's inside this archive?"
                          onBlur={(e) => act(() => saveLegalFile(f.id, doc.id, "archive_contents", e.target.value || null))}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <select defaultValue={f.file_kind} className="input w-auto py-1" onChange={(e) => act(() => saveLegalFile(f.id, doc.id, "file_kind", e.target.value))}>
                        {FILE_KINDS.map((k) => <option key={k}>{k}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="input py-1"
                        defaultValue={f.signed_by ?? ""}
                        onBlur={(e) => e.target.value !== (f.signed_by ?? "") && act(() => saveLegalFile(f.id, doc.id, "signed_by", e.target.value || null))}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="date" className="input py-1" defaultValue={f.signed_at ?? ""} onBlur={(e) => act(() => saveLegalFile(f.id, doc.id, "signed_at", e.target.value || null))} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="date" className="input py-1" defaultValue={f.expires_at ?? ""} onBlur={(e) => act(() => saveLegalFile(f.id, doc.id, "expires_at", e.target.value || null))} />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        className="text-xs text-muted hover:text-danger"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Delete ${f.file_name}?`)) return;
                          act(() => deleteLegalFile(f.id, doc.id));
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── access log ── */}
      {!!access.length && (
        <section className="card mb-5">
          <h2 className="section-title mb-0">Document access log</h2>
          <p className="mb-3 text-sm text-muted">Recorded automatically, and can&apos;t be edited or deleted</p>
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">File</th>
                <th className="py-2 font-medium">Who</th>
                <th className="py-2 font-medium">How</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {access.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 whitespace-nowrap text-muted">
                    {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(new Date(a.accessed_at))}
                  </td>
                  <td className="py-2">{a.file_name}</td>
                  <td className="py-2">{a.accessed_by}</td>
                  <td className="py-2"><Tag>{a.access_type}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── history ── */}
      <section className="card mb-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="section-title mb-0">History</h2>
            <p className="text-sm text-muted">
              {changes.length ? `${changes.length} recorded` : "Nothing recorded yet"}
              {unexplained > 0 && ` · ${unexplained} with no reason`}
            </p>
          </div>
          <Link className="btn-ghost" href="/legal/changes">All documents</Link>
        </div>
        <Note>
          <strong>What changed is recorded automatically; why it changed isn&apos;t.</strong> Nothing can infer a reason, and it&apos;s the part an audit asks about. Record one against any change
          that alters what a person agreed to.
        </Note>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="label">Record a note</label>
            <input className="input" value={note.summary} placeholder="Advice received, a question raised, a decision not to change" onChange={(e) => setNote({ ...note, summary: e.target.value })} />
          </div>
          <div className="min-w-48 flex-1">
            <label className="label">Reason for the change</label>
            <input className="input" value={note.reason} onChange={(e) => setNote({ ...note, reason: e.target.value })} />
          </div>
          <div className="w-44">
            <label className="label">Prompted by</label>
            <input className="input" value={note.prompted} onChange={(e) => setNote({ ...note, prompted: e.target.value })} />
          </div>
          <button
            className="btn-ghost"
            disabled={pending || !note.summary.trim()}
            onClick={() =>
              act(async () => {
                const res = await addChangeNote(doc.id, note.summary, note.reason, note.prompted);
                if (res.ok) setNote({ summary: "", reason: "", prompted: "" });
                return res;
              })
            }
          >
            Record
          </button>
        </div>
        {!!changes.length && (
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">What</th>
                <th className="py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {changes.map((c) => {
                const t = CHANGE_TYPE[c.change_type] ?? { label: c.change_type, tone: "plain" as const };
                const needs = NEEDS_REASON.includes(c.change_type) && !c.reason;
                return (
                  <tr key={c.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">{auDate(c.changed_at)}</td>
                    <td className="py-2 pr-3">
                      <Tag tone={t.tone}>{t.label}</Tag>
                      <p className="mt-1 max-w-sm text-xs text-muted">
                        {c.summary}
                        {c.changed_by && ` · ${c.changed_by}`}
                      </p>
                    </td>
                    <td className="max-w-xs py-2">
                      {c.reason ? (
                        <p className="text-sm">
                          {c.reason}
                          {c.prompted_by && <span className="block text-xs text-muted">Prompted by {c.prompted_by}</span>}
                        </p>
                      ) : needs ? (
                        <input
                          className="input border-warn"
                          placeholder="Why did this change?"
                          onBlur={(e) => e.target.value && act(() => explainChange(c.id, doc.id, "reason", e.target.value))}
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── archiving, then removing: two steps, kept well away from the publish switch ── */}
      <section className="card">
        <h2 className="section-title">Archiving and removing</h2>
        {!doc.archived_at ? (
          <>
            <p className="mb-4 text-sm text-muted">Archiving takes it out of use and unpublishes it. It&apos;s the only route to deleting, and almost always far enough on its own.</p>
            <label className="label" htmlFor="archive-why">Why is it being archived?</label>
            <textarea id="archive-why" className="input" rows={2} value={archiveWhy} placeholder="Superseded by the new coach agreement, drafted in error…" onChange={(e) => setArchiveWhy(e.target.value)} />
            <p className="mt-1 text-xs text-muted">Required. An archived document with no reason is impossible to tell, in six months, from one archived by mistake.</p>
            <button
              className="btn-ghost mt-3"
              disabled={pending || archiveWhy.trim().length < 10}
              onClick={() =>
                act(async () => {
                  const res = await archiveLegalDocument(doc.id, archiveWhy);
                  if (res.ok) setArchiveWhy("");
                  return res;
                })
              }
            >
              Archive it
            </button>
          </>
        ) : (
          <>
            <Note>
              <strong>
                Archived{doc.archived_at && ` on ${auDate(doc.archived_at, true)}`}
                {doc.archived_by && ` by ${doc.archived_by}`}.
              </strong>{" "}
              {doc.archive_reason}
            </Note>
            <div className="flex flex-wrap gap-3">
              <button className="btn-ghost" disabled={pending} onClick={() => act(() => restoreLegalDocument(doc.id))}>
                Take it out of the archive
              </button>
              {!removing && isOwner && (
                <button
                  className={`btn-ghost ${acceptances > 0 ? "" : "text-danger"}`}
                  disabled={pending || acceptances > 0}
                  title={acceptances > 0 ? "It has been accepted, so it can't be deleted" : undefined}
                  onClick={() => setRemoving(true)}
                >
                  Delete it for good
                </button>
              )}
            </div>
            {!isOwner && <p className="mt-2 text-sm text-muted">Deleting is owner level only. Archived is as far as this account goes, and it&apos;s the reversible half anyway.</p>}
            {isOwner && acceptances > 0 && !removing && (
              <p className="mt-2 text-sm text-muted">
                {acceptances} {acceptances === 1 ? "person has" : "people have"} accepted this, so archived is as far as it goes. Deleting it wouldn&apos;t undo what they agreed to, only lose
                the evidence of it.
              </p>
            )}
            {removing && (
              <div className="mt-4 rounded-xl bg-danger/10 p-4 text-sm">
                <p className="mb-3">
                  Delete <strong>{doc.name}</strong> for good? Its versions, wording and files go with it, and it can&apos;t be undone. The reason below is kept afterwards — it will be the only
                  trace left.
                </p>
                <label className="label" htmlFor="delete-why">Why is it being deleted?</label>
                <textarea id="delete-why" className="input" rows={2} value={deleteWhy} placeholder="Duplicate of another document, never used, no acceptances…" onChange={(e) => setDeleteWhy(e.target.value)} />
                <div className="mt-3 flex gap-3">
                  <button
                    className="btn bg-danger"
                    disabled={pending || deleteWhy.trim().length < 10}
                    onClick={() =>
                      start(async () => {
                        report("saving");
                        const res = await deleteLegalDocument(doc.id, deleteWhy);
                        if (!res.ok) {
                          setMsg({ ok: false, text: res.error });
                          report("error", "Didn't delete");
                          setRemoving(false);
                          return;
                        }
                        report("saved");
                        router.push("/legal");
                      })
                    }
                  >
                    {pending ? "Deleting…" : "Yes, delete it"}
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={pending}
                    onClick={() => {
                      setRemoving(false);
                      setDeleteWhy("");
                    }}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
