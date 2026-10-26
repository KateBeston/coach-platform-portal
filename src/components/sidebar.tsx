"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Area } from "@/lib/staff";

type Item = { href: string; label: string; area?: Area; count?: number };
type Group = { title: string; items: Item[] };

/**
 * Every section is a heading that folds. An item a role can't enter stays visible but
 * greyed, so a limited role sees the shape of the portal and can open only its part.
 */
export function Sidebar({ groups, areas }: { groups: Group[]; areas: Area[] }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
      {groups.map((g) => (
        <NavGroup key={g.title} title={g.title} startOpen={g.title !== "Settings" || path.startsWith("/settings") || path.startsWith("/account")}>
          {g.items.map((i) => {
            const allowed = !i.area || areas.includes(i.area);
            const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
            const cls = "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm";
            const inner = (
              <>
                <span>{i.label}</span>
                {i.count !== undefined && <span className="text-xs text-white/45">{i.count}</span>}
              </>
            );
            return allowed ? (
              <Link key={i.href} href={i.href} className={`${cls} ${active ? "bg-white/15 font-medium" : "text-white/75 hover:bg-white/10"}`}>
                {inner}
              </Link>
            ) : (
              <span key={i.href} className={`${cls} cursor-not-allowed text-white/30`} title="Your role doesn't include this" aria-disabled="true">
                {inner}
              </span>
            );
          })}
        </NavGroup>
      ))}
    </nav>
  );
}

function NavGroup({ title, startOpen, children }: { title: string; startOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 pb-1 text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase hover:text-white/70"
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
