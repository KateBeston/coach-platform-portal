import { NextResponse, type NextRequest } from "next/server";
import { renderLegal, renderPlain } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* GET /api/legal/{slug}?format=json|html|md|txt — what the website and coach app read.
   Only published documents with wording in force are served; a draft returns 404.
   Open to anyone: it's public text by definition. */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_legal_document", { p_slug: slug });
  const d = data as { slug: string; name: string; summary: string | null; category: string | null; audience: string; meta_title: string | null; meta_description: string | null; version_id: number; version_label: string | null; effective_from: string | null; change_summary: string | null; body: string } | null;
  if (!d) return NextResponse.json({ error: "Not found or not published." }, { status: 404, headers: cors });
  const filename = `${d.slug}-${d.effective_from ?? "current"}`;

  if (format === "html") return new NextResponse(renderLegal(d.body), { headers: { "Content-Type": "text/html; charset=utf-8", ...cors } });
  if (format === "md")
    return new NextResponse(d.body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.md"`, ...cors } });
  if (format === "txt")
    return new NextResponse(renderPlain(d.body), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.txt"`, ...cors } });

  return NextResponse.json(
    {
      slug: d.slug,
      name: d.name,
      summary: d.summary,
      category: d.category,
      audience: d.audience,
      meta: { title: d.meta_title, description: d.meta_description },
      version: { id: d.version_id, label: d.version_label, effective_from: d.effective_from, change_summary: d.change_summary },
      body_markdown: d.body,
      body_html: renderLegal(d.body),
    },
    { headers: cors },
  );
}
