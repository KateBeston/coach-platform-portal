"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tabs across a record. The first tab is the record's own address. */
export function SectionTabs({ base, tabs }: { base: string; tabs: { slug: string; label: string; off?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap border-b border-line" aria-label="Sections">
      {tabs.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = path === href;
        const cls = "-mb-px border-b-2 px-4 py-2.5 text-xs tracking-[0.06em] whitespace-nowrap uppercase";
        return t.off ? (
          <span key={t.slug} className={`${cls} cursor-not-allowed border-transparent text-muted/50`} title="Your role doesn't include this">
            {t.label}
          </span>
        ) : (
          <Link key={t.slug} href={href} className={`${cls} ${active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
