import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { SessionTimeout } from "@/components/session-timeout";
import { Sidebar } from "@/components/sidebar";
import { getStaff, ROLE_LABEL } from "@/lib/staff";
import { signOut } from "../login/actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, me, areas } = await getStaff();
  const { count: coachCount } = await supabase.from("coach_accounts").select("*", { count: "exact", head: true });

  const groups = [
    { title: "Overview", items: [{ href: "/", label: "Home", area: "overview" as const }] },
    { title: "Records", items: [{ href: "/coaches", label: "Coaches", area: "coaches" as const, count: coachCount ?? 0 }] },
    {
      title: "Settings",
      items: [
        { href: "/settings/people", label: "People", area: "people" as const },
        { href: "/settings/access", label: "Access log", area: "access" as const },
        { href: "/account", label: "My account" },
      ],
    },
  ];

  return (
    <div className="min-h-screen md:flex">
      <SessionTimeout />
      <aside className="flex flex-col bg-ink text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="px-5 py-5">
          <p className="font-serif text-lg">Coach Platform</p>
          <p className="text-[11px] tracking-[0.2em] text-white/50 uppercase">Internal</p>
        </div>
        <Sidebar groups={groups} areas={areas} />
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Logged in as</p>
          <p className="truncate text-sm">{me.name || user.email}</p>
          <p className="text-xs text-white/50">{ROLE_LABEL[me.role]}</p>
          <form action={signOut}>
            <button className="mt-2 text-xs text-white/70 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-4 border-b border-line bg-surface px-4 py-2.5 text-sm md:px-8">
          <BackLink />
          <Link href="/" className="text-muted hover:text-ink">Home</Link>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
