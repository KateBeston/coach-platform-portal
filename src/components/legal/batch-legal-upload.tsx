"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { matchFilesToDocuments, uploadMatchedFile, type FileMatch } from "@/app/(portal)/legal/actions";
import { useSaveState } from "@/components/save-state";
import { ACCEPT_LEGAL, detectFormat, FILE_KINDS, humanSize } from "@/lib/legal";
import { Note, Tag } from "./fields";

type Doc = { id: number; name: string; category: string | null };
type Outcome = "done" | "skipped" | "failed";

const CONFIDENCE = {
  Exact: { label: "Exact", tone: "accent" },
  Strong: { label: "Strong", tone: "accent" },
  Possible: { label: "Check", tone: "warn" },
  None: { label: "No match", tone: "clay" },
} as const;

/* Filenames are matched to documents and shown before anything is attached. A misfiled
   legal document is worse than an unfiled one, because it looks filed. Each file uploads
   separately so one failure doesn't lose the rest, and re-running is safe. */
export function BatchLegalUpload({ documents }: { documents: Doc[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [assigned, setAssigned] = useState<Record<string, number | null>>({});
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const choose = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setFiles(picked);
    setOutcome({});
    setErrors({});
    setMsg("");
    start(async () => {
      const result = await matchFilesToDocuments(picked.map((f) => f.name));
      setMatches(result);
      setAssigned(Object.fromEntries(result.map((m) => [m.fileName, m.documentId])));
      setKinds(Object.fromEntries(result.map((m) => [m.fileName, "Published PDF"])));
    });
  };

  const ready = matches.filter((m) => assigned[m.fileName] && outcome[m.fileName] !== "done");
  const unmatched = matches.filter((m) => !assigned[m.fileName]);
  const needsCheck = matches.filter((m) => m.confidence === "Possible" && assigned[m.fileName]);

  const run = () =>
    start(async () => {
      report("saving");
      let done = 0, failed = 0, skipped = 0;
      for (const m of ready) {
        const file = files.find((f) => f.name === m.fileName);
        const documentId = assigned[m.fileName];
        if (!file || !documentId) continue;
        const fd = new FormData();
        fd.set("legal_document_id", String(documentId));
        fd.set("file_kind", kinds[m.fileName] ?? "Published PDF");
        fd.set("file", file);
        const res = await uploadMatchedFile(fd);
        if (res.ok) {
          const wasSkipped = !!res.message?.includes("already attached");
          setOutcome((o) => ({ ...o, [m.fileName]: wasSkipped ? "skipped" : "done" }));
          if (wasSkipped) skipped++;
          else done++;
        } else {
          setOutcome((o) => ({ ...o, [m.fileName]: "failed" }));
          setErrors((e) => ({ ...e, [m.fileName]: res.error }));
          failed++;
        }
      }
      report(failed ? "error" : "saved", failed ? "Some failed" : undefined);
      setMsg([done ? `${done} attached` : null, skipped ? `${skipped} already there` : null, failed ? `${failed} failed` : null].filter(Boolean).join(" · ") || "Nothing to upload.");
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Batch upload</h1>
          <p className="mt-1 text-sm text-muted">
            {matches.length ? `${matches.length} file${matches.length === 1 ? "" : "s"} · ${ready.length} ready` : "Match files to documents by name"}
          </p>
        </div>
        <Link className="btn-ghost" href="/legal">Back to Legal</Link>
      </div>

      <Note>
        <strong>Nothing is attached until you confirm it.</strong> Filenames are matched to document names and shown below with how confident the match is.
      </Note>

      <section className="card mb-5">
        <h2 className="section-title">Choose files</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn cursor-pointer">
            {files.length ? "Choose different files" : "Choose files"}
            <input type="file" hidden multiple disabled={pending} accept={ACCEPT_LEGAL} onChange={(e) => choose(e.target.files)} />
          </label>
          <span className="text-xs text-muted">PDF, Word, spreadsheets, text, images and archives · up to 25 MB each · no limit on how many</span>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </section>

      {!!matches.length && (
        <>
          {(!!unmatched.length || !!needsCheck.length) && (
            <Note tone="warn">
              {!!needsCheck.length && (
                <>
                  <strong>{needsCheck.length} to check.</strong> The match is plausible but another document was close behind. Read those rows before uploading.
                  <br />
                </>
              )}
              {!!unmatched.length && (
                <>
                  <strong>{unmatched.length} unmatched.</strong> Choose a document for each, or leave it unassigned and it will be left out.
                </>
              )}
            </Note>
          )}
          <section className="card">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title mb-0">Matches</h2>
                <p className="text-sm text-muted">Change any of them before uploading</p>
              </div>
              <button className="btn" disabled={pending || !ready.length} onClick={run}>{pending ? "Uploading…" : `Upload ${ready.length}`}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-sm text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 font-medium">File</th>
                    <th className="py-2 font-medium">Match</th>
                    <th className="py-2 font-medium">Attach to</th>
                    <th className="py-2 font-medium">Kind</th>
                    <th className="py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {matches.map((m) => {
                    const conf = CONFIDENCE[m.confidence];
                    const state = outcome[m.fileName];
                    const file = files.find((f) => f.name === m.fileName);
                    return (
                      <tr key={m.fileName} className={state === "done" || state === "skipped" ? "opacity-50" : ""}>
                        <td className="py-2 pr-2">
                          <p className="font-medium">{m.fileName}</p>
                          {file && <p className="text-xs text-muted">{detectFormat(file.name, file.type)?.label ?? "File"} · {humanSize(file.size)}</p>}
                        </td>
                        <td className="max-w-56 py-2 pr-2">
                          <Tag tone={conf.tone}>{conf.label}</Tag>
                          <p className="mt-1 text-xs text-muted">{m.reason}</p>
                        </td>
                        <td className="min-w-56 py-2 pr-2">
                          <select
                            className="input py-1"
                            value={assigned[m.fileName] ?? ""}
                            disabled={pending}
                            onChange={(e) => setAssigned((a) => ({ ...a, [m.fileName]: e.target.value ? Number(e.target.value) : null }))}
                          >
                            <option value="">Leave out</option>
                            {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </td>
                        <td className="min-w-36 py-2 pr-2">
                          <select className="input py-1" value={kinds[m.fileName] ?? "Published PDF"} disabled={pending} onChange={(e) => setKinds((k) => ({ ...k, [m.fileName]: e.target.value }))}>
                            {FILE_KINDS.map((k) => <option key={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="py-2">
                          {state === "done" && <Tag tone="accent">Attached</Tag>}
                          {state === "skipped" && <Tag>Already there</Tag>}
                          {state === "failed" && (
                            <>
                              <Tag tone="warn">Failed</Tag>
                              <p className="text-xs text-danger">{errors[m.fileName]}</p>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
