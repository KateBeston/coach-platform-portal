"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The legal section's views, across the top. Not a layout, so the print view stays clean. */
const TABS = [
  { href: "/legal", label: "Register", exact: true },
  { href: "/legal/acceptances", label: "Acceptances" },
  { href: "/legal/changes", label: "Change history" },
];

export function LegalTabs() {
  const path = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap border-b border-line" aria-label="Legal sections">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm whitespace-nowrap ${active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
