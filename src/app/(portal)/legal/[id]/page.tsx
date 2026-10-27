import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocumentEditor } from "@/components/legal/legal-document-editor";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function LegalDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) notFound();
  const { supabase } = await requireArea("legal");
  const { data: doc } = await supabase.from("legal_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) notFound();

  const [{ data: versions }, { data: files }, { count: acceptances }, { data: changes }, { data: access }, { data: owner }, { data: site }] = await Promise.all([
    supabase.from("legal_document_versions").select("*").eq("legal_document_id", docId).order("created_at", { ascending: false }),
    supabase.from("legal_files").select("*").eq("legal_document_id", docId).order("uploaded_at", { ascending: false }),
    supabase.from("legal_acceptances").select("*", { count: "exact", head: true }).eq("legal_document_id", docId),
    supabase.from("legal_change_log").select("*").eq("legal_document_id", docId).order("changed_at", { ascending: false }).limit(40),
    supabase.from("legal_file_access").select("*").eq("legal_document_id", docId).order("accessed_at", { ascending: false }).limit(30),
    supabase.rpc("is_portal_owner"),
    supabase.from("platform_settings").select("setting_value").eq("setting_group", "Legal entity").eq("setting_key", "website").maybeSingle(),
  ]);

  return (
    <>
      <p className="mb-2 text-sm text-muted"><Link href="/legal" className="hover:text-ink">Legal</Link> · {doc.name}</p>
      <LegalDocumentEditor
        doc={doc}
        versions={versions ?? []}
        files={files ?? []}
        acceptances={acceptances ?? 0}
        changes={changes ?? []}
        access={access ?? []}
        isOwner={Boolean(owner)}
        appUrl={process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://coach-platform-portal.vercel.app"}
        website={site?.setting_value ?? null}
      />
    </>
  );
}
