"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createLegalDocument } from "@/app/(portal)/legal/actions";
import { CATEGORIES, TYPES } from "@/lib/legal";

export function NewLegalDocument() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("Public");
  const [category, setCategory] = useState("Website");
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label className="label" htmlFor="ld">Add a document</label>
        <input id="ld" className="input" value={name} placeholder="Document name" onChange={(e) => setName(e.target.value)} />
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </div>
      <div className="w-36">
        <label className="label" htmlFor="lt">For</label>
        <select id="lt" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="w-52">
        <label className="label" htmlFor="lc">Category</label>
        <select id="lc" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <button
        className="btn"
        disabled={pending || !name.trim()}
        onClick={() =>
          start(async () => {
            const res = await createLegalDocument(name, type, category);
            if (res.ok && res.id) router.push(`/legal/${res.id}`);
            else if (!res.ok) setErr(res.error);
          })
        }
      >
        Create
      </button>
    </div>
  );
}
