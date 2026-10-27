"use client";

import { useTransition } from "react";
import { saveEntitySetting } from "@/app/(portal)/legal/actions";
import { useSaveState } from "@/components/save-state";

const FIELDS = [
  { key: "legal_entity_name", label: "Legal entity name", placeholder: "e.g. Aurella Group Pty Ltd" },
  { key: "abn", label: "ABN", placeholder: "00 000 000 000" },
  { key: "registered_address", label: "Registered address", placeholder: "" },
  { key: "website", label: "Website", placeholder: "https://…" },
];

/** The business named on printed documents and the archive. */
export function EntityForm({ values }: { values: Record<string, string> }) {
  const { report } = useSaveState();
  const [, start] = useTransition();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <input
            className="input"
            defaultValue={values[f.key] ?? ""}
            placeholder={f.placeholder}
            onBlur={(e) =>
              e.target.value !== (values[f.key] ?? "") &&
              start(async () => {
                report("saving");
                const res = await saveEntitySetting(f.key, e.target.value);
                report(res.ok ? "saved" : "error", res.ok ? undefined : res.error);
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
