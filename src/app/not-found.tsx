import Link from "next/link";
import { BackLink } from "@/components/back-link";

/** Any address that matches no route. No portal shell: signed-out visitors see this too. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <p className="font-serif text-2xl font-normal">Coach Platform</p>
        <p className="mb-6 text-xs tracking-[0.18em] text-clay uppercase">Internal portal</p>
        <h1 className="text-3xl">Not found</h1>
        <p className="mt-1 mb-5 text-sm text-muted">That address doesn&apos;t match anything in the portal. If you followed a link from inside it, the link is wrong.</p>
        <div className="flex gap-2">
          <BackLink className="btn" />
          <Link className="btn-ghost" href="/">Portal home</Link>
        </div>
      </div>
    </main>
  );
}
