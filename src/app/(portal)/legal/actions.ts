"use server";

import { revalidatePath } from "next/cache";
import { detectFormat, isArchive, slugify } from "@/lib/legal";
import { requireArea } from "@/lib/staff";

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

const DOC_COLUMNS = new Set([
  "name", "slug", "document_type", "category", "summary", "requires_acceptance", "meta_title", "meta_description",
  "is_published", "display_order", "jurisdiction", "owner_note", "review_due", "reviewed_by", "reviewed_at", "used_on",
  "doc_status", "sensitivity", "needs_attention",
]);
const VERSION_COLUMNS = new Set(["version_label", "body", "effective_from", "effective_to", "change_summary", "approved_by", "approved_at"]);
const FILE_COLUMNS = new Set(["file_kind", "signed_by", "signed_at", "counterparty", "expires_at", "notes", "external_url", "archive_contents"]);
const LOG_COLUMNS = new Set(["reason", "prompted_by", "reference", "summary"]);

function humanise(m: string) {
  if (/duplicate key.*slug/i.test(m)) return "That slug is already in use.";
  if (/protect_published_slug/i.test(m)) return "The slug can't change while the document is published — unpublish it first.";
  return m.replace(/^.*?ERROR:\s*/, "");
}

const legal = () => requireArea("legal");
const touch = (id?: number) => {
  revalidatePath("/legal");
  if (id) revalidatePath(`/legal/${id}`);
};

export async function isPortalOwner() {
  const { supabase } = await legal();
  const { data } = await supabase.rpc("is_portal_owner");
  return Boolean(data);
}

export async function saveLegalDocument(id: number, column: string, value: unknown): Promise<Result> {
  if (!DOC_COLUMNS.has(column)) return { ok: false, error: `"${column}" isn't editable on a legal document.` };
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_documents").update({ [column]: value }).eq("id", id);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(id);
  return { ok: true };
}

export async function createLegalDocument(name: string, type: string, category: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "A name is required." };
  const { supabase } = await legal();
  const { count } = await supabase.from("legal_documents").select("*", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("legal_documents")
    .insert({ name: trimmed, slug: slugify(trimmed), document_type: type, category, requires_acceptance: type === "Coach" || type === "Client", display_order: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanise(error.message) };
  touch();
  return { ok: true, id: data.id };
}

/* ── archiving, then deleting ──────────────────────────────────────────────
   A legal document is partly an audit trail, so deleting is the end of a path:
   archive it with a reason (it's unpublished on the way), and only then can an
   owner delete it, with its own reason kept after it's gone. */

async function dependants(id: number) {
  const { supabase } = await legal();
  const [{ data: versions }, { data: doc }, { count: files }] = await Promise.all([
    supabase.from("legal_document_versions").select("id").eq("legal_document_id", id),
    supabase.from("legal_documents").select("is_published, name, slug, document_type, category, archived_at, archive_reason").eq("id", id).single(),
    supabase.from("legal_files").select("*", { count: "exact", head: true }).eq("legal_document_id", id),
  ]);
  const { count: accepted } = await supabase.from("legal_acceptances").select("*", { count: "exact", head: true }).eq("legal_document_id", id);
  return {
    name: doc?.name ?? "That document",
    slug: doc?.slug ?? null,
    documentType: doc?.document_type ?? null,
    category: doc?.category ?? null,
    isPublished: Boolean(doc?.is_published),
    archivedAt: doc?.archived_at ?? null,
    archiveReason: doc?.archive_reason ?? null,
    versions: (versions ?? []).length,
    files: files ?? 0,
    accepted: accepted ?? 0,
  };
}

export async function archiveLegalDocument(id: number, reason: string): Promise<Result> {
  const said = reason.trim();
  if (said.length < 10) return { ok: false, error: "Say why it's being archived, in a sentence." };
  const { supabase, me, user } = await legal();
  const { error } = await supabase
    .from("legal_documents")
    .update({ archived_at: new Date().toISOString(), archived_by: me.name || user.email, archive_reason: said, doc_status: "Retired", is_published: false })
    .eq("id", id);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(id);
  return { ok: true, message: "Archived, and unpublished." };
}

export async function restoreLegalDocument(id: number): Promise<Result> {
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_documents").update({ archived_at: null, archived_by: null, archive_reason: null, doc_status: "In draft" }).eq("id", id);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(id);
  return { ok: true, message: "Back in draft. Not published." };
}

export async function deleteLegalDocument(id: number, reason: string): Promise<Result> {
  const said = reason.trim();
  if (said.length < 10) return { ok: false, error: "Say why it's being deleted, in a sentence. It's kept after the document is gone, and it's the only thing that will be." };
  if (!(await isPortalOwner())) return { ok: false, error: "Only an owner can delete a legal document. Archiving is open to anyone in Legal, and is reversible — this isn't." };
  const d = await dependants(id);
  if (d.isPublished) return { ok: false, error: "It's published. Unpublish it first." };
  if (!d.archivedAt) return { ok: false, error: "It hasn't been archived. Archive it first, saying why — most of the time archived turns out to be far enough." };
  if (d.accepted > 0)
    return { ok: false, error: `${d.accepted} ${d.accepted === 1 ? "person has" : "people have"} accepted a version of this, so it can't be deleted. Archived is as far as it goes.` };

  const { supabase } = await legal();
  const { error: logErr } = await supabase.from("legal_document_deletions").insert({
    document_id: id, name: d.name, slug: d.slug, document_type: d.documentType, category: d.category,
    versions_removed: d.versions, files_removed: d.files, acceptances_at_deletion: d.accepted,
    archived_at: d.archivedAt, archive_reason: d.archiveReason, reason: said,
  });
  if (logErr) return { ok: false, error: `The reason couldn't be recorded, so nothing was deleted: ${logErr.message}` };

  const { data: files } = await supabase.from("legal_files").select("storage_path").eq("legal_document_id", id);
  const { error } = await supabase.from("legal_documents").delete().eq("id", id);
  if (error) return { ok: false, error: humanise(error.message) };
  // A delete the owner-only policy refuses comes back clean, so check rather than assume.
  const { count: survives } = await supabase.from("legal_documents").select("*", { count: "exact", head: true }).eq("id", id);
  if ((survives ?? 0) > 0) return { ok: false, error: "The database refused the deletion and the document is still there." };
  const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("legal").remove(paths);
  touch();
  return { ok: true, message: `Deleted ${d.name}, with ${d.versions} ${d.versions === 1 ? "version" : "versions"}. The reason is on record.` };
}

/* ── versions: a new version never edits the old one ───────────────────── */

export async function createVersion(documentId: number, label: string, effectiveFrom: string): Promise<Result> {
  const { supabase } = await legal();
  const { data: current } = await supabase.from("legal_document_versions").select("body").eq("legal_document_id", documentId).eq("is_current", true).maybeSingle();
  const { data: latest } = current
    ? { data: null }
    : await supabase.from("legal_document_versions").select("body").eq("legal_document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("legal_document_versions")
    .insert({
      legal_document_id: documentId,
      version_label: label.trim() || null,
      effective_from: effectiveFrom || new Date().toISOString().slice(0, 10),
      // Carried forward: a revision is usually a paragraph, not a rewrite.
      body: current?.body ?? latest?.body ?? null,
      is_current: false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanise(error.message) };
  touch(documentId);
  return { ok: true, id: data.id, message: `${label} started from the current wording.` };
}

export async function saveVersion(versionId: number, documentId: number, column: string, value: unknown): Promise<Result> {
  if (!VERSION_COLUMNS.has(column)) return { ok: false, error: `"${column}" isn't editable on a version.` };
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_document_versions").update({ [column]: value }).eq("id", versionId);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(documentId);
  return { ok: true };
}

/** Putting a version in force closes the previous one rather than deleting it. */
export async function makeCurrent(versionId: number, documentId: number): Promise<Result> {
  const { supabase } = await legal();
  const { data: v } = await supabase.from("legal_document_versions").select("effective_from").eq("id", versionId).single();
  const dayBefore = v?.effective_from
    ? new Date(new Date(v.effective_from).getTime() - 86_400_000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  await supabase.from("legal_document_versions").update({ is_current: false, effective_to: dayBefore }).eq("legal_document_id", documentId).eq("is_current", true);
  const { error } = await supabase.from("legal_document_versions").update({ is_current: true, effective_to: null }).eq("id", versionId);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(documentId);
  return { ok: true, message: "This version is now in force." };
}

export async function deleteVersion(versionId: number, documentId: number): Promise<Result> {
  if (!(await isPortalOwner())) return { ok: false, error: "Only an owner can delete a version." };
  const { supabase } = await legal();
  const { data: v } = await supabase.from("legal_document_versions").select("is_current, version_label").eq("id", versionId).single();
  if (!v) return { ok: false, error: "No such version." };
  if (v.is_current) return { ok: false, error: "That's the version in force. Put another one in force first." };
  const { count: accepted } = await supabase.from("legal_acceptances").select("*", { count: "exact", head: true }).eq("version_id", versionId);
  if ((accepted ?? 0) > 0)
    return { ok: false, error: `${accepted} ${accepted === 1 ? "person accepted" : "people accepted"} this exact wording. It has to stay, or the record of what they agreed to no longer exists.` };
  const { error } = await supabase.from("legal_document_versions").delete().eq("id", versionId);
  if (error) return { ok: false, error: humanise(error.message) };
  touch(documentId);
  return { ok: true, message: `Deleted ${v.version_label ?? "that version"}.` };
}

/* ── files ─────────────────────────────────────────────────────────────── */

async function storeFile(documentId: number, file: File, kind: string): Promise<Result> {
  const { supabase } = await legal();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
  const path = `${documentId}/${Date.now()}-${safe}.${ext}`;
  const { error: upErr } = await supabase.storage.from("legal").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) {
    if (/exceeded the maximum/i.test(upErr.message)) return { ok: false, error: `${file.name} is over the 25 MB limit.` };
    return { ok: false, error: `${file.name} — ${upErr.message}` };
  }
  const { error } = await supabase.from("legal_files").insert({
    legal_document_id: documentId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size_bytes: file.size,
    file_kind: kind,
    file_format: detectFormat(file.name, file.type)?.key ?? null,
    archive_contents: isArchive(file.name, file.type) ? "Not described — say what's inside so it can be found later" : null,
  });
  if (error) {
    await supabase.storage.from("legal").remove([path]);
    return { ok: false, error: `${file.name} — ${error.message}` };
  }
  touch(documentId);
  return { ok: true, message: isArchive(file.name, file.type) ? `${file.name} uploaded. Describe what's inside it — an archive can't be searched.` : `${file.name} uploaded.` };
}

export async function uploadLegalFile(fd: FormData): Promise<Result> {
  const documentId = Number(fd.get("legal_document_id"));
  const file = fd.get("file") as File | null;
  if (!documentId || !file || !file.size) return { ok: false, error: "No file received." };
  return storeFile(documentId, file, String(fd.get("file_kind") ?? "Reference"));
}

export async function saveLegalFile(fileId: number, documentId: number, column: string, value: unknown): Promise<Result> {
  if (!FILE_COLUMNS.has(column)) return { ok: false, error: `"${column}" isn't editable.` };
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_files").update({ [column]: value }).eq("id", fileId);
  if (error) return { ok: false, error: error.message };
  touch(documentId);
  return { ok: true };
}

export async function deleteLegalFile(fileId: number, documentId: number): Promise<Result> {
  const { supabase } = await legal();
  const { data: row } = await supabase.from("legal_files").select("storage_path").eq("id", fileId).single();
  const { error } = await supabase.from("legal_files").delete().eq("id", fileId);
  if (error) return { ok: false, error: error.message };
  if (row?.storage_path) await supabase.storage.from("legal").remove([row.storage_path]);
  touch(documentId);
  return { ok: true };
}

export async function addFileByUrl(documentId: number, url: string, name: string, kind: string): Promise<Result> {
  if (!/^https?:\/\//i.test(url.trim())) return { ok: false, error: "That isn't a usable link." };
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_files").insert({ legal_document_id: documentId, file_name: name.trim() || url.trim(), external_url: url.trim(), file_kind: kind });
  if (error) return { ok: false, error: error.message };
  touch(documentId);
  return { ok: true };
}

/** Records that a file was opened and returns a link that lasts five minutes. */
export async function openLegalFile(fileId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { supabase, me, user } = await legal();
  const { data: file } = await supabase.from("legal_files").select("*, legal_documents(id, name)").eq("id", fileId).single();
  if (!file) return { ok: false, error: "File not found, or it's privileged and owners only." };
  let url = file.external_url as string | null;
  if (file.storage_path) {
    const { data: signed, error } = await supabase.storage.from("legal").createSignedUrl(file.storage_path, 300);
    if (error || !signed?.signedUrl) return { ok: false, error: error?.message ?? "Couldn't open the file." };
    url = signed.signedUrl;
  }
  if (!url) return { ok: false, error: "This record has no file attached." };
  await supabase.from("legal_file_access").insert({
    legal_file_id: file.id,
    legal_document_id: file.legal_document_id,
    file_name: file.file_name,
    document_name: (file.legal_documents as { name?: string } | null)?.name ?? null,
    accessed_by: me.name || user.email,
    access_type: file.storage_path ? "Download" : "Link",
  });
  return { ok: true, url };
}

/* ── batch upload: match filenames to documents, confirm, then upload ───── */

export type FileMatch = {
  fileName: string;
  documentId: number | null;
  documentName: string | null;
  confidence: "Exact" | "Strong" | "Possible" | "None";
  reason: string;
};

function normaliseName(s: string) {
  return s
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[_\s-]*[Vv]\d+(\.\d+)?$/, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const NOISE = new Set(["policy", "agreement", "terms", "and", "the", "of", "statement", "form", "reference", "declaration", "conditions"]);
function score(a: string[], b: string[]) {
  const m = (w: string[]) => w.filter((x) => !NOISE.has(x) && x.length > 2);
  const f = new Set(m(a));
  const d = new Set(m(b));
  if (!f.size || !d.size) return 0;
  let shared = 0;
  for (const w of f) if (d.has(w)) shared++;
  return shared / Math.min(f.size, d.size);
}

export async function matchFilesToDocuments(fileNames: string[]): Promise<FileMatch[]> {
  const { supabase } = await legal();
  const { data: docs } = await supabase.from("legal_documents").select("id, name, slug").order("name");
  return fileNames.map((fileName) => {
    const norm = normaliseName(fileName);
    const scored = (docs ?? [])
      .map((d) => {
        const dn = normaliseName(d.name);
        const sn = d.slug.replace(/-/g, " ");
        if (norm === dn || norm === sn) return { id: d.id, name: d.name, score: 1, exact: true };
        return { id: d.id, name: d.name, score: Math.max(score(norm.split(" "), dn.split(" ")), score(norm.split(" "), sn.split(" "))), exact: false };
      })
      .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || b.score - a.score);
    const best = scored[0];
    const runnerUp = scored[1];
    if (!best || best.score < 0.34) return { fileName, documentId: null, documentName: null, confidence: "None" as const, reason: "No document name resembles this filename." };
    const margin = best.score - (runnerUp?.score ?? 0);
    const confidence = best.exact ? "Exact" : best.score >= 0.75 && margin >= 0.2 ? "Strong" : "Possible";
    return {
      fileName,
      documentId: best.id,
      documentName: best.name,
      confidence,
      reason: best.exact
        ? "The filename matches the document name exactly."
        : confidence === "Strong"
          ? "Matches on the distinctive words, and nothing else comes close."
          : `Closest match, but ${runnerUp?.name ?? "another document"} isn't far behind — check this one.`,
    };
  });
}

export async function uploadMatchedFile(fd: FormData): Promise<Result> {
  const documentId = Number(fd.get("legal_document_id"));
  const file = fd.get("file") as File | null;
  if (!documentId || !file || !file.size) return { ok: false, error: "No file received." };
  const { supabase } = await legal();
  // Running the batch again is safe: the same name on the same document is skipped.
  const { data: existing } = await supabase.from("legal_files").select("id").eq("legal_document_id", documentId).eq("file_name", file.name).maybeSingle();
  if (existing) return { ok: true, message: `${file.name} is already attached.` };
  return storeFile(documentId, file, String(fd.get("file_kind") ?? "Published PDF"));
}

/* ── change log ────────────────────────────────────────────────────────── */

export async function explainChange(logId: number, documentId: number | null, column: string, value: unknown): Promise<Result> {
  if (!LOG_COLUMNS.has(column)) return { ok: false, error: `"${column}" isn't editable on a log entry.` };
  const { supabase } = await legal();
  const { error } = await supabase.from("legal_change_log").update({ [column]: value }).eq("id", logId);
  if (error) return { ok: false, error: humanise(error.message) };
  if (documentId) revalidatePath(`/legal/${documentId}`);
  revalidatePath("/legal/changes");
  return { ok: true };
}

/** A note against a document without editing anything: advice received, a decision not to change. */
export async function addChangeNote(documentId: number, summary: string, reason: string, promptedBy: string): Promise<Result> {
  if (!summary.trim()) return { ok: false, error: "Describe what happened." };
  const { supabase } = await legal();
  const { error } = await supabase
    .from("legal_change_log")
    .insert({ legal_document_id: documentId, change_type: "Reviewed", summary: summary.trim(), reason: reason.trim() || null, prompted_by: promptedBy.trim() || null });
  if (error) return { ok: false, error: error.message };
  touch(documentId);
  return { ok: true, message: "Recorded." };
}

/* ── legal entity (used on printed documents and the archive) ──────────── */

export async function saveEntitySetting(key: string, value: string): Promise<Result> {
  if (!["legal_entity_name", "abn", "registered_address", "website"].includes(key)) return { ok: false, error: "Unknown setting." };
  const { supabase } = await legal();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ setting_group: "Legal entity", setting_key: key, setting_value: value.trim() || null, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/legal");
  return { ok: true };
}

