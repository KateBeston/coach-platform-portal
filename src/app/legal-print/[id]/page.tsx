import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { auDate, readingMinutes, renderLegal } from "@/lib/legal";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** A clean document for printing or saving as PDF, with no portal around it. Any version can be produced. */
export default async function LegalPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ audience?: string; version?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const docId = Number(id);
  const { supabase } = await requireArea("legal");
  const { data: doc } = await supabase.from("legal_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) notFound();
  const [{ data: versions }, { data: settings }] = await Promise.all([
    supabase.from("legal_document_versions").select("*").eq("legal_document_id", docId).order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("setting_key, setting_value").eq("setting_group", "Legal entity"),
  ]);
  const all = versions ?? [];
  const version = sp.version ? all.find((v) => String(v.id) === sp.version) : all.find((v) => v.is_current) ?? all[0];
  const entity = Object.fromEntries((settings ?? []).map((s) => [s.setting_key, s.setting_value ?? ""]));
  const internal = sp.audience === "internal";
  const html = renderLegal(version?.body);
  const minutes = readingMinutes(version?.body);
  const warning = !version?.body ? "This document has no wording yet." : !doc.is_published && !internal ? "This document is a draft and isn't published." : null;
  const q = (extra: Record<string, string>) => new URLSearchParams({ ...(internal ? { audience: "internal" } : {}), ...(version ? { version: String(version.id) } : {}), ...extra }).toString();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/legal/${doc.id}`} className="text-sm text-accent hover:underline">← Back to the document</Link>
        <div className="flex flex-wrap gap-2">
          <Link className={internal ? "btn-ghost btn-sm" : "btn btn-sm"} href={`/legal-print/${doc.id}?${new URLSearchParams(version ? { version: String(version.id) } : {})}`}>Public copy</Link>
          <Link className={internal ? "btn btn-sm" : "btn-ghost btn-sm"} href={`/legal-print/${doc.id}?${q({ audience: "internal" })}`}>Internal record</Link>
          <a className="btn-ghost btn-sm" href={`/api/legal/${doc.slug}?format=md`}>Markdown</a>
          <a className="btn-ghost btn-sm" href={`/api/legal/${doc.slug}?format=txt`}>Plain text</a>
          <PrintButton />
        </div>
      </div>

      {warning && <p className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn print:hidden">{warning}</p>}

      <header className="mb-6 border-b border-line pb-5">
        <p className="text-xs tracking-[0.18em] text-clay uppercase">{internal ? "Internal record" : "Legal"}</p>
        <h1 className="mt-1 font-serif text-4xl">{doc.name}</h1>
        <div className="mt-2 space-y-0.5 text-sm text-muted">
          {entity.legal_entity_name && <p>{entity.legal_entity_name}{entity.abn ? ` · ABN ${entity.abn}` : ""}</p>}
          <p>{version?.version_label ? `${version.version_label} · ` : ""}{version?.effective_from ? `In force from ${auDate(version.effective_from, true)}` : "No effective date set"}</p>
          {minutes > 0 && <p>About {minutes} minute{minutes === 1 ? "" : "s"} to read</p>}
        </div>
      </header>

      {internal && (
        <section className="mb-6 rounded-xl border border-line p-4 text-sm">
          <h2 className="mb-2 font-serif text-xl">Record</h2>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
            {[
              ["Version", version?.version_label],
              ["In force from", auDate(version?.effective_from, true)],
              ["In force to", version?.effective_to ? auDate(version.effective_to, true) : version?.is_current ? "Current" : "—"],
              ["What changed", version?.change_summary],
              ["Approved by", version?.approved_by],
              ["Total versions", all.length > 1 ? String(all.length) : null],
              ["Published", doc.is_published ? "Yes" : "Draft"],
              ["Requires acceptance", doc.requires_acceptance ? "Yes" : "No"],
              ["Jurisdiction", doc.jurisdiction],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {html ? <article className="legal-body" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-muted">No wording has been written for this document yet.</p>}

      {internal && all.length > 1 && (
        <section className="mt-8 text-sm">
          <h2 className="mb-2 font-serif text-xl">Version history</h2>
          <table className="w-full">
            <thead className="text-left text-muted">
              <tr className="border-b border-line"><th className="py-1.5 font-medium">Version</th><th className="py-1.5 font-medium">From</th><th className="py-1.5 font-medium">To</th><th className="py-1.5 font-medium">Changed</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {all.map((v) => (
                <tr key={v.id}>
                  <td className="py-1.5">{v.version_label ?? "—"}{v.is_current && " · current"}</td>
                  <td className="py-1.5">{auDate(v.effective_from) || "—"}</td>
                  <td className="py-1.5">{v.effective_to ? auDate(v.effective_to) : v.is_current ? "Current" : "—"}</td>
                  <td className="py-1.5">{v.change_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {all.length > 1 && (
        <div className="mt-8 rounded-xl bg-accent-soft/70 p-4 text-sm print:hidden">
          <strong>Printing an earlier version.</strong> If someone questions what they agreed to, the wording in force on that date can be produced — choose it here.
          <div className="mt-3 flex flex-wrap gap-1.5">
            {all.map((v) => (
              <Link key={v.id} className={`pill ${version?.id === v.id ? "bg-accent text-white" : "bg-surface ring-1 ring-line"}`} href={`/legal-print/${doc.id}?${new URLSearchParams({ ...(internal ? { audience: "internal" } : {}), version: String(v.id) })}`}>
                {v.version_label ?? "Untitled"}{v.effective_from && ` · ${auDate(v.effective_from)}`}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
