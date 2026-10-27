/* Legal register vocabulary, rendering and file types (modelled on the TGS portal). */

export const TYPES = ["Public", "Coach", "Client", "Staff", "Partner", "Internal", "Consent", "Template"];
export const CATEGORIES = [
  "Website", "Coach agreements", "Data & privacy", "Consent", "Client templates",
  "Staff & contractors", "Insurance & compliance", "Internal policy", "Templates",
];

/** Where a document stands. A draft on a website is a liability; a draft here is work in progress. */
export const DOC_STATUS: { key: string; label: string; tone: string; note: string }[] = [
  { key: "In draft", label: "In draft", tone: "text-muted", note: "Being written. Cannot be published." },
  { key: "Under review", label: "Under review", tone: "text-warn", note: "Written, and needs checking before it binds anybody." },
  { key: "With adviser", label: "With adviser", tone: "text-clay", note: "Out with the lawyer or accountant." },
  { key: "Current", label: "Current", tone: "text-accent", note: "In force." },
  { key: "Superseded", label: "Superseded", tone: "text-muted", note: "Replaced by another document." },
  { key: "Retired", label: "Retired", tone: "text-muted", note: "No longer used." },
];

export const FILE_KINDS = ["Published PDF", "Signed copy", "Draft", "Solicitor advice", "Certificate", "Reference"];

/** Who can see it. Privileged exists because legal advice is covered by professional privilege. */
export const SENSITIVITY = [
  { key: "Public", label: "Public — on the website" },
  { key: "Internal", label: "Internal — legal area" },
  { key: "Restricted", label: "Restricted — legal area only" },
  { key: "Privileged", label: "Privileged — owners only" },
];

export const NEEDS_REASON = ["Wording", "Put in force", "Published", "Unpublished"];

export const CHANGE_TYPE: Record<string, { label: string; tone: "accent" | "plain" | "warn" }> = {
  Created: { label: "Created", tone: "plain" },
  Wording: { label: "Wording", tone: "accent" },
  Field: { label: "Detail", tone: "plain" },
  "Version created": { label: "New version", tone: "accent" },
  "Version deleted": { label: "Version deleted", tone: "warn" },
  "Put in force": { label: "Put in force", tone: "accent" },
  Published: { label: "Published", tone: "accent" },
  Unpublished: { label: "Unpublished", tone: "warn" },
  "File added": { label: "File added", tone: "plain" },
  "File removed": { label: "File removed", tone: "warn" },
  Reviewed: { label: "Note", tone: "plain" },
};

/** Next label in the 1.0, 1.1, 1.2 pattern. */
export function nextVersionLabel(labels: (string | null)[]) {
  let major = 1, minor = -1;
  for (const l of labels) {
    const m = (l ?? "").match(/(\d+)\.(\d+)/);
    if (!m) continue;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > major || (a === major && b > minor)) [major, minor] = [a, b];
  }
  return `v${major}.${minor + 1}`;
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

/* ── rendering: a small Markdown subset, everything escaped first ───────── */

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

export function renderLegal(body: string | null | undefined): string {
  if (!body) return "";
  const lines = String(body).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      closeList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    // A numbered clause (1., 1.1, 12.3.4) is a heading in a legal document, not a list item.
    const clause = line.match(/^(\d+(?:\.\d+)*\.?)\s+(.{3,90})$/);
    if (clause && !/[.;,]$/.test(clause[2]) && clause[2].length < 80) {
      flush();
      closeList();
      out.push(`<h3 class="clause"><span class="num">${clause[1]}</span> ${inline(clause[2])}</h3>`);
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flush();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const numbered = line.match(/^\d+[).]\s+(.*)$/);
    if (numbered) {
      flush();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      flush();
      closeList();
      out.push("<hr />");
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  flush();
  closeList();
  return out.join("\n");
}

export function renderPlain(body: string | null | undefined) {
  if (!body) return "";
  return String(body)
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^[-*•]\s+/gm, "· ");
}

export function readingMinutes(body: string | null | undefined) {
  if (!body) return 0;
  return Math.max(1, Math.round(String(body).split(/\s+/).length / 200));
}

/* ── file types: the extension is more reliable than the browser's MIME type ── */

type FileFormat = { key: string; label: string; extensions: string[]; mimes: string[]; isArchive?: boolean };

export const FILE_FORMATS: FileFormat[] = [
  { key: "pdf", label: "PDF", extensions: ["pdf"], mimes: ["application/pdf"] },
  { key: "word", label: "Word", extensions: ["doc", "docx", "odt"], mimes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.oasis.opendocument.text"] },
  { key: "spreadsheet", label: "Spreadsheet", extensions: ["xls", "xlsx", "ods", "csv"], mimes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.oasis.opendocument.spreadsheet", "text/csv"] },
  { key: "text", label: "Text", extensions: ["txt", "md", "rtf"], mimes: ["text/plain", "text/markdown", "application/rtf", "text/rtf"] },
  { key: "image", label: "Image", extensions: ["jpg", "jpeg", "png", "webp", "tif", "tiff", "heic"], mimes: ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/heic"] },
  { key: "archive", label: "Archive", extensions: ["zip", "7z", "gz", "tar"], mimes: ["application/zip", "application/x-zip-compressed", "multipart/x-zip", "application/x-7z-compressed", "application/gzip", "application/x-tar"], isArchive: true },
  { key: "signature", label: "Signature", extensions: ["p7s", "p7b"], mimes: ["application/pkcs7-signature", "application/x-pkcs7-certificates"] },
];

export function detectFormat(fileName: string, mime?: string | null) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FILE_FORMATS.find((f) => f.extensions.includes(ext)) ?? (mime ? FILE_FORMATS.find((f) => f.mimes.includes(mime)) : undefined) ?? null;
}

export const isArchive = (fileName: string, mime?: string | null) => detectFormat(fileName, mime)?.isArchive === true;

export const ACCEPT_LEGAL = [...FILE_FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)), ...FILE_FORMATS.flatMap((f) => f.mimes)].join(",");

export function humanSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const auDate = (d: string | null | undefined, long = false) =>
  d
    ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: long ? "long" : "short", year: "numeric", timeZone: "Australia/Brisbane" }).format(
        new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T00:00:00+10:00" : d),
      )
    : "";
