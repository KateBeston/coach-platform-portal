import Link from "next/link";
import { EntityForm } from "@/components/legal/entity-form";
import { Note, Tag } from "@/components/legal/fields";
import { LegalTabs } from "@/components/legal/legal-tabs";
import { NewLegalDocument } from "@/components/legal/new-legal-document";
import { Stat } from "@/components/ui";
import { auDate, CATEGORIES } from "@/lib/legal";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

type Doc = {
  id: number; name: string; summary: string | null; document_type: string; category: string | null; is_published: boolean;
  requires_acceptance: boolean; doc_status: string; needs_attention: string | null; archived_at: string | null;
};

export default async function LegalPage() {
  const { supabase } = await requireArea("legal");
  const [{ data: docs }, { data: versions }, { data: files }, { count: acceptances }, { data: exports }, { data: settings }] = await Promise.all([
    supabase.from("legal_documents").select("*").order("display_order").order("id"),
    supabase.from("legal_document_versions").select("legal_document_id, is_current, effective_from, version_label"),
    supabase.from("legal_files").select("legal_document_id"),
    supabase.from("legal_acceptances").select("*", { count: "exact", head: true }),
    supabase.from("compliance_exports").select("*").eq("export_kind", "Legal").order("exported_at", { ascending: false }).limit(6),
    supabase.from("platform_settings").select("setting_key, setting_value").eq("setting_group", "Legal entity"),
  ]);

  const currentFor = new Map<number, { effective_from: string | null; version_label: string | null }>();
  const versionCount = new Map<number, number>();
  for (const v of versions ?? []) {
    versionCount.set(v.legal_document_id, (versionCount.get(v.legal_document_id) ?? 0) + 1);
    if (v.is_current) currentFor.set(v.legal_document_id, v);
  }
  const fileCount = new Map<number, number>();
  for (const f of files ?? []) fileCount.set(f.legal_document_id, (fileCount.get(f.legal_document_id) ?? 0) + 1);

  const all = (docs ?? []) as Doc[];
  const live = all.filter((d) => !d.archived_at);
  const archived = all.filter((d) => d.archived_at);
  const grouped = CATEGORIES.map((cat) => ({ cat, items: live.filter((d) => d.category === cat) })).filter((g) => g.items.length);
  const uncategorised = live.filter((d) => !d.category || !CATEGORIES.includes(d.category));
  const drafted = live.filter((d) => currentFor.has(d.id)).length;
  const published = live.filter((d) => d.is_published).length;
  const attention = live.filter((d) => d.needs_attention);
  const inForce = live.filter((d) => d.doc_status === "Current").length;
  const drafts = live.filter((d) => d.doc_status === "In draft");
  const checking = live.filter((d) => ["Under review", "With adviser"].includes(d.doc_status));
  const entity = Object.fromEntries((settings ?? []).map((s) => [s.setting_key, s.setting_value ?? ""]));

  const table = (items: Doc[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-sm text-muted">
          <tr className="border-b border-line">
            <th className="py-2 font-medium">Document</th>
            <th className="py-2 font-medium">For</th>
            <th className="py-2 font-medium">Wording</th>
            <th className="py-2 font-medium">Files</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {items.map((d) => {
            const cur = currentFor.get(d.id);
            return (
              <tr key={d.id}>
                <td className="py-2.5 pr-3">
                  <Link href={`/legal/${d.id}`} className="font-medium hover:text-accent">{d.name}</Link>
                  {d.summary && <p className="max-w-md text-xs text-muted">{d.summary}</p>}
                </td>
                <td className="py-2.5 pr-3"><Tag>{d.document_type}</Tag></td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  {cur ? (
                    <>
                      {cur.version_label ?? "Current"}
                      {cur.effective_from && <div>from {auDate(cur.effective_from)}</div>}
                    </>
                  ) : (
                    <Tag tone="clay">Not in force</Tag>
                  )}
                  {(versionCount.get(d.id) ?? 0) > 1 && <div>{versionCount.get(d.id)} versions</div>}
                </td>
                <td className="py-2.5 pr-3">{fileCount.get(d.id) ?? <span className="text-muted">0</span>}</td>
                <td className="py-2.5">
                  {d.is_published ? <Tag tone="accent">Published</Tag> : <Tag>{d.doc_status}</Tag>}
                  {d.requires_acceptance && <p className="mt-1 text-xs text-muted">Needs acceptance</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <LegalTabs />

      {!!attention.length && (
        <Note tone="warn">
          <strong>{attention.length} document{attention.length === 1 ? "" : "s"} need a look.</strong>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attention.map((d) => (
              <Link key={d.id} href={`/legal/${d.id}`} className="pill bg-surface text-warn ring-1 ring-warn/30" title={d.needs_attention ?? ""}>{d.name}</Link>
            ))}
          </div>
        </Note>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="In force" value={String(inForce)} />
        <div className="card">
          <p className="text-sm font-medium text-muted">Still to write</p>
          <p className="mt-1 font-serif text-3xl text-accent">{drafts.length}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {drafts.map((d) => <Link key={d.id} href={`/legal/${d.id}`} className="pill border border-dashed border-line text-muted hover:text-ink">{d.name}</Link>)}
          </div>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-muted">Needs checking</p>
          <p className="mt-1 font-serif text-3xl text-warn">{checking.length}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {checking.map((d) => <Link key={d.id} href={`/legal/${d.id}`} className="pill bg-warn-soft text-warn">{d.name}</Link>)}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Legal</h1>
          <p className="mt-1 text-sm text-muted">{live.length} documents · {drafted} with wording in force · {published} published</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Documents" value={String(live.length)} />
        <Stat label="Have wording" value={String(drafted)} />
        <Stat label="Published" value={String(published)} />
        <Stat label="Acceptances recorded" value={String(acceptances ?? 0)} href="/legal/acceptances" />
      </div>

      <Note>
        <strong>Wording is edited here, not in the website.</strong> The website and the coach app read published documents from this register.
      </Note>

      <section className="card mb-5">
        <NewLegalDocument />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link className="btn-ghost" href="/legal/upload">Batch upload files</Link>
          <Link className="btn-ghost" href="/legal/changes">Change history</Link>
          <span className="text-xs text-muted">Drop in a folder of PDFs and they&apos;re matched to documents by name</span>
        </div>
      </section>

      {grouped.map((g) => (
        <section key={g.cat} className="card mb-5">
          <h2 className="section-title">{g.cat}</h2>
          {table(g.items)}
        </section>
      ))}
      {!!uncategorised.length && (
        <section className="card mb-5">
          <h2 className="section-title">Uncategorised</h2>
          {table(uncategorised)}
        </section>
      )}

      <section className="card mb-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="section-title mb-0">Compliance archive</h2>
            <p className="text-sm text-muted">{exports?.length ? `Last taken ${auDate(exports[0].exported_at)}` : "Never taken"}</p>
          </div>
          <div className="flex gap-2">
            <a className="btn" href="/api/compliance/legal">Download everything</a>
            <a className="btn-ghost" href="/api/compliance/legal?files=no">Wording only</a>
          </div>
        </div>
        <Note>
          <strong>One file holding everything</strong> — the wording of every version, the files uploaded against each document, the acceptance records, and a manifest.
        </Note>
        {!!exports?.length && (
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Taken</th>
                <th className="py-2 font-medium">By</th>
                <th className="py-2 font-medium">Documents</th>
                <th className="py-2 font-medium">Versions</th>
                <th className="py-2 font-medium">Files</th>
                <th className="py-2 font-medium">Acceptances</th>
                <th className="py-2 font-medium">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {exports.map((e) => (
                <tr key={e.id}>
                  <td className="py-2">{auDate(e.exported_at)}{e.notes && <div className="text-xs text-warn">{e.notes}</div>}</td>
                  <td className="py-2">{e.exported_by}</td>
                  <td className="py-2">{e.documents_count}</td>
                  <td className="py-2">{e.versions_count}</td>
                  <td className="py-2">{e.files_count}</td>
                  <td className="py-2">{e.acceptances_count}</td>
                  <td className="py-2 text-muted">{e.size_bytes ? `${Math.round(e.size_bytes / 1024)} KB` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card mb-5">
        <h2 className="section-title">Legal entity</h2>
        <p className="mb-3 text-sm text-muted">Named on printed documents and in the compliance archive.</p>
        <EntityForm values={entity} />
      </section>

      {!!archived.length && (
        <section className="card">
          <h2 className="section-title">Archived</h2>
          {table(archived)}
        </section>
      )}
    </>
  );
}
