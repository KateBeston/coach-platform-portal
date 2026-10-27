import Link from "next/link";
import { Note } from "@/components/legal/fields";
import { LegalTabs } from "@/components/legal/legal-tabs";
import { auDate } from "@/lib/legal";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** Every acceptance: who agreed to which version, when, and whether the wording is still what they agreed to. */
export default async function AcceptancesPage({ searchParams }: { searchParams: Promise<{ document?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireArea("legal");
  let query = supabase.from("acceptance_record").select("*", { count: "exact" }).order("accepted_at", { ascending: false }).limit(300);
  if (sp.document) query = query.eq("document_slug", sp.document);
  if (sp.q) query = query.or(`signatory_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,signatory_email.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data, count }, { data: docs }] = await Promise.all([query, supabase.from("legal_documents").select("slug, name").eq("requires_acceptance", true).order("name")]);
  const rows = data ?? [];
  const problems = rows.filter((r) => r.integrity !== "Intact").length;

  return (
    <>
      <LegalTabs />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Acceptances</h1>
          <p className="mt-1 text-sm text-muted">{(count ?? 0).toLocaleString("en-AU")} recorded</p>
        </div>
        <form className="flex gap-2">
          {sp.document && <input type="hidden" name="document" value={sp.document} />}
          <input name="q" defaultValue={sp.q ?? ""} className="input w-56" placeholder="Name or email" />
          <button className="btn-ghost">Search</button>
        </form>
      </div>

      {problems > 0 ? (
        <Note tone="warn">
          <strong>{problems} {problems === 1 ? "record doesn't" : "records don't"} match the wording agreed to.</strong> Something was edited after somebody accepted it. The database refuses
          that now, so this came through a route that bypassed it.
        </Note>
      ) : (
        <Note>
          <strong>Every record intact.</strong> The wording is fingerprinted the moment somebody agrees, and editing accepted wording is refused — so what they agreed to can be produced exactly,
          years later.
        </Note>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link href="/legal/acceptances" className={`pill ${!sp.document ? "bg-accent text-white" : "bg-surface ring-1 ring-line"}`}>All documents</Link>
        {(docs ?? []).map((d) => (
          <Link key={d.slug} href={`/legal/acceptances?document=${d.slug}`} className={`pill ${sp.document === d.slug ? "bg-accent text-white" : "bg-surface ring-1 ring-line"}`}>
            {d.name}
          </Link>
        ))}
      </div>

      {!rows.length ? (
        <p className="card text-sm text-muted">Nothing recorded yet. Acceptances appear here the moment a coach signs up and agrees to the published coach documents.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Length</th>
                <th className="px-4 py-3 font-medium">Wording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    {r.signatory_name ?? "—"}
                    <div className="text-xs text-muted">{r.signatory_email}</div>
                    {r.coach_business && <div className="text-xs text-muted">{r.coach_business}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/legal/acceptances?document=${r.document_slug}`} className="hover:text-accent">{r.document}</Link>
                    <div className="text-xs text-muted">{r.source}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.version}</td>
                  <td className="px-4 py-2.5">
                    {auDate(r.accepted_at)}
                    <div className="text-xs text-muted">
                      {new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(new Date(r.accepted_at))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.characters_agreed_to?.toLocaleString("en-AU") ?? "—"}</td>
                  <td className={`px-4 py-2.5 ${r.integrity === "Intact" ? "text-xs text-muted" : "text-warn"}`}>
                    {r.integrity}
                    {r.fingerprint && <div className="font-mono text-xs text-muted">{String(r.fingerprint).slice(0, 12)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
