"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type State = "idle" | "saving" | "saved" | "error";
const Ctx = createContext<{ state: State; note?: string; report: (s: State, note?: string) => void }>({ state: "idle", report: () => {} });

/** Fields save as you leave them; this shows that it happened, in the top bar. */
export function SaveStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState<string | undefined>();
  const report = useCallback((s: State, n?: string) => {
    setState(s);
    setNote(n);
  }, []);
  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);
  return <Ctx.Provider value={{ state, note, report }}>{children}</Ctx.Provider>;
}

export const useSaveState = () => useContext(Ctx);

export function SaveIndicator() {
  const { state, note } = useSaveState();
  if (state === "idle") return null;
  const text = state === "saving" ? "Saving…" : state === "saved" ? "Saved" : note ?? "Didn't save";
  const tone = state === "error" ? "text-danger" : state === "saved" ? "text-accent" : "text-muted";
  return <span className={`text-sm ${tone}`}>{text}</span>;
}
