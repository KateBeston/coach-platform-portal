import Link from "next/link";
import { startSupportAction } from "@/app/(portal)/actions";

/** The button that opens a coach's account in the coach app, with the reason recorded. */
export function OpenAccount({ coachId, compact }: { coachId: string; compact?: boolean }) {
  return (
    <form action={startSupportAction} className={compact ? "flex flex-wrap gap-2" : "space-y-2"}>
      <input type="hidden" name="coach_id" value={coachId} />
      <input name="reason" className={`input ${compact ? "min-w-48 flex-1" : ""}`} required minLength={3} placeholder="Why, e.g. helping set up invoices" />
      <button className="btn">Open their account</button>
      {!compact && (
        <p className="text-xs text-muted">
          Opens the coach app as this business&apos;s owner for two hours. You can see and change everything they can. Every session is recorded.{" "}
          <Link href={`/coaches/${coachId}/support`} className="text-accent hover:underline">History</Link>
        </p>
      )}
    </form>
  );
}
