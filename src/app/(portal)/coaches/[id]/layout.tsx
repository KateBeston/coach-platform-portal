import Link from "next/link";
import { SectionTabs } from "@/components/section-tabs";
import { Pill } from "@/components/ui";
import { getCoachRecord } from "@/lib/coach-record";
import { fmtDate } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

export default async function CoachLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { c, name, can } = await getCoachRecord(id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <>
      <p className="text-sm text-muted"><Link href="/coaches" className="hover:text-ink">Coaches</Link> /</p>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {c.is_internal ? <Pill status="internal" label="staff test" /> : <Pill status={c.status ?? "trial"} />}
            {c.email && <a href={`mailto:${c.email}`} className="hover:text-ink">{c.email}</a>}
            {c.business_name && c.display_name && <span>· {c.display_name}</span>}
            <span>· joined {fmtDate(c.created_at, PORTAL_TZ)}</span>
          </p>
        </div>
        {c.booking_slug && (
          <a href={`${appUrl}/book/${c.booking_slug}`} target="_blank" className="btn-ghost">Their booking page</a>
        )}
      </div>
      <SectionTabs
        base={`/coaches/${id}`}
        tabs={[
          { slug: "", label: "Overview" },
          { slug: "team", label: "Team" },
          { slug: "account", label: "Plan and billing", off: !can("accounts") },
          { slug: "notes", label: "Notes", off: !can("notes") },
          { slug: "support", label: "Support access", off: !can("coach_access") },
        ]}
      />
      {children}
    </>
  );
}
