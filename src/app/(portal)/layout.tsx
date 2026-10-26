import { PortalNav } from "@/components/portal-nav";
import { getStaff } from "@/lib/staff";
import { signOut } from "../login/actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getStaff();
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink text-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col">
        <div className="px-4 py-4">
          <p className="font-serif text-lg">Coach Platform</p>
          <p className="text-xs tracking-widest text-white/50 uppercase">Internal</p>
        </div>
        <PortalNav />
        <div className="mt-auto hidden px-4 py-4 md:block">
          <p className="truncate text-xs text-white/50">{user.email}</p>
          <form action={signOut}>
            <button className="mt-1 text-xs text-white/70 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
