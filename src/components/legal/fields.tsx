"use client";

import { useState } from "react";

/** A text field that saves when you click away. */
export function F({ label, initial, onSave, help, textarea }: { label: string; initial: unknown; onSave: (v: string | null) => void; help?: string; textarea?: boolean }) {
  const start = initial == null ? "" : String(initial);
  const [v, setV] = useState(start);
  const commit = () => {
    if (v !== start) onSave(v === "" ? null : v);
  };
  return (
    <div>
      <label className="label">{label}</label>
      {textarea ? (
        <textarea className="input min-h-20" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      )}
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}

/** A date field that saves when you click away. */
export function D({ label, initial, onSave, help }: { label: string; initial: unknown; onSave: (v: string | null) => void; help?: string }) {
  const start = initial ? String(initial).slice(0, 10) : "";
  const [v, setV] = useState(start);
  return (
    <div>
      <label className="label">{label}</label>
      <input type="date" className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== start && onSave(v || null)} />
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}

export function Note({ tone, children }: { tone?: "bad" | "warn"; children: React.ReactNode }) {
  const cls = tone === "bad" ? "bg-danger/10 text-danger" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-accent-soft/70 text-ink";
  return <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Tag({ tone, children, onClick, disabled }: { tone?: "accent" | "warn" | "plain" | "clay"; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  const cls =
    tone === "accent" ? "bg-accent text-white" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "clay" ? "bg-clay-soft text-clay" : "bg-stone-soft text-muted";
  if (onClick)
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={`pill cursor-pointer ${cls}`}>
        {children}
      </button>
    );
  return <span className={`pill ${cls}`}>{children}</span>;
}
