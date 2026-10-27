import { ChangeLog } from "@/components/legal/change-log";
import { LegalTabs } from "@/components/legal/legal-tabs";
import { auDate } from "@/lib/legal";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireArea("legal");
  let query = supabase.from("legal_change_log").select("*, legal_documents(id, name, requires_acceptance)").order("changed_at", { ascending: false }).limit(300);
  if (sp.filter === "unexplained") query = query.is("reason", null).in("change_type", ["Wording", "Put in force", "Published", "Unpublished"]);
  const [{ data: entries }, { count: unexplained }, { data: deletions }] = await Promise.all([
    query,
    supabase.from("unexplained_legal_changes").select("*", { count: "exact", head: true }),
    supabase.from("legal_document_deletions").select("*").order("deleted_at", { ascending: false }),
  ]);

  return (
    <>
      <LegalTabs />
      <ChangeLog entries={entries ?? []} unexplained={unexplained ?? 0} filter={sp.filter ?? "all"} />
      {!!deletions?.length && (
        <section className="card mt-6">
          <h2 className="section-title">Deleted documents</h2>
          <p className="mb-3 text-sm text-muted">The document is gone; why it went is kept.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Deleted</th>
                <th className="py-2 font-medium">Document</th>
                <th className="py-2 font-medium">Why</th>
                <th className="py-2 font-medium">Removed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {deletions.map((d) => (
                <tr key={d.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{auDate(d.deleted_at)}<div className="text-xs text-muted">{d.deleted_by}</div></td>
                  <td className="py-2 pr-3">{d.name}<div className="text-xs text-muted">{d.document_type} · {d.category}</div></td>
                  <td className="py-2 pr-3">{d.reason}{d.archive_reason && <div className="text-xs text-muted">Archived because: {d.archive_reason}</div>}</td>
                  <td className="py-2 text-xs text-muted">{d.versions_removed} versions · {d.files_removed} files</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
