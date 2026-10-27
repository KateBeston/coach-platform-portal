import { Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { PORTAL_TZ } from "@/lib/staff";

export type AccessRow = { id: number; email: string; event: string; reason: string | null; ip: string | null; user_agent: string | null; created_at: string };

/** Browser and system from a user agent, enough to tell one device from another. */
function device(ua: string | null) {
  if (!ua) return "Unknown";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

const TONE: Record<string, string> = { Failed: "text-warn", "Signed in": "text-accent", Joined: "text-accent" };

export function AccessTable({ rows, showEmail = true }: { rows: AccessRow[]; showEmail?: boolean }) {
  if (!rows.length) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-sm text-muted">
          <tr>
            <th className="pb-2 font-medium">When</th>
            {showEmail && <th className="pb-2 font-medium">Who</th>}
            <th className="pb-2 font-medium">Event</th>
            <th className="pb-2 font-medium">Device</th>
            <th className="pb-2 font-medium">Address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2 whitespace-nowrap text-muted">{fmtDateTime(r.created_at, PORTAL_TZ)}</td>
              {showEmail && <td className="py-2">{r.email}</td>}
              <td className={`py-2 ${TONE[r.event] ?? ""}`}>
                {r.event}
                {r.reason && <span className="block text-xs text-muted">{r.reason}</span>}
              </td>
              <td className="py-2">{device(r.user_agent)}</td>
              <td className="py-2 text-muted">{r.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
