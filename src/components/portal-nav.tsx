"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/coaches", label: "Coaches" },
];

export function PortalNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${active ? "bg-white/15 font-medium" : "text-white/75 hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
