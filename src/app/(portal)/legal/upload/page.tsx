import Link from "next/link";
import { BatchLegalUpload } from "@/components/legal/batch-legal-upload";
import { requireArea } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function BatchUploadPage() {
  const { supabase } = await requireArea("legal");
  const { data } = await supabase.from("legal_documents").select("id, name, category").is("archived_at", null).order("category").order("name");
  return (
    <>
      <p className="mb-2 text-sm text-muted"><Link href="/legal" className="hover:text-ink">Legal</Link> · Batch upload</p>
      <BatchLegalUpload documents={data ?? []} />
    </>
  );
}
