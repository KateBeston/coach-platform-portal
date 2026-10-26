import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div>
      <h1 className="text-3xl">Not found</h1>
      <p className="mt-1 mb-5 text-sm text-muted">That record doesn&apos;t exist, or it&apos;s been removed.</p>
      <div className="flex gap-2">
        <Link className="btn" href="/coaches">Coaches</Link>
        <Link className="btn-ghost" href="/">Home</Link>
      </div>
    </div>
  );
}
